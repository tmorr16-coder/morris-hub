import Foundation
import Combine
import HealthKit
import BackgroundTasks
import UIKit

struct LogLine: Codable, Identifiable {
    var id = UUID()
    let at: Date
    let text: String
    let ok: Bool
}

/// Decides when to read Apple Health and what to send.
///
/// Three things start a sync. Apple Health itself, through background
/// delivery, which is the one that makes this near real time. The phone being
/// unlocked, because Health cannot be read while it is locked and an update
/// that arrived in a pocket has to wait for that. And the app being opened.
///
/// Every sync re-reads the last two days in hourly buckets and sends only the
/// buckets whose value changed since they were last sent. That keeps each
/// upload small, makes a missed wake-up harmless, and lets the current hour
/// fill in as the day goes on.
@MainActor
final class SyncEngine: ObservableObject {
    static let shared = SyncEngine()
    static let refreshTaskId = "family.morrisai.healthsync.refresh"

    @Published private(set) var paired = false
    @Published private(set) var healthRequested = false
    @Published private(set) var syncing = false
    @Published private(set) var lastSyncAt: Date?
    @Published private(set) var lastMessage = "Not synced yet"
    @Published private(set) var log: [LogLine] = []
    @Published var pendingCode: String?

    private let reader = HealthReader()
    private let defaults = UserDefaults.standard
    private var started = false
    private var observing = false
    private var runAgain = false

    private enum Key {
        static let token = "device-token"
        static let healthRequested = "health-requested"
        static let lastSync = "last-sync"
        static let lastMessage = "last-message"
        static let sent = "sent-buckets"
        static let sentWorkouts = "sent-workouts"
        static let log = "log"
    }

    private init() {
        paired = Keychain.get(Key.token) != nil
        healthRequested = defaults.bool(forKey: Key.healthRequested)
        lastSyncAt = defaults.object(forKey: Key.lastSync) as? Date
        lastMessage = defaults.string(forKey: Key.lastMessage) ?? "Not synced yet"
        if let data = defaults.data(forKey: Key.log),
           let lines = try? JSONDecoder().decode([LogLine].self, from: data) {
            log = lines
        }
    }

    // MARK: Lifecycle

    func start() {
        guard !started else { return }
        started = true
        NotificationCenter.default.addObserver(
            forName: UIApplication.protectedDataDidBecomeAvailableNotification,
            object: nil, queue: .main
        ) { _ in
            Task { @MainActor in await SyncEngine.shared.sync(reason: "phone unlocked") }
        }
        if healthRequested { beginObserving() }
    }

    func requestHealthAccess() async {
        guard reader.available else {
            note("Apple Health is not available on this device.", ok: false)
            return
        }
        do {
            try await reader.requestAuthorization()
            healthRequested = true
            defaults.set(true, forKey: Key.healthRequested)
            beginObserving()
            await sync(reason: "access granted")
        } catch {
            note("Could not ask for Health access: \(error.localizedDescription)", ok: false)
        }
    }

    /// Ask Apple Health to wake the app whenever any of these types changes.
    private func beginObserving() {
        guard !observing, reader.available else { return }
        observing = true
        for type in reader.observedTypes {
            // HealthKit calls this on its own queue, not the main one.
            let query = HKObserverQuery(sampleType: type, predicate: nil) { @Sendable _, completion, error in
                guard error == nil else {
                    completion()
                    return
                }
                Task { @MainActor in
                    await SyncEngine.shared.sync(reason: "Apple Health update")
                    // Telling HealthKit we are done is what keeps the
                    // deliveries coming; an app that never answers is
                    // eventually no longer woken.
                    completion()
                }
            }
            reader.store.execute(query)
            reader.store.enableBackgroundDelivery(for: type, frequency: .immediate) { _, _ in }
        }
    }

    // MARK: Pairing

    func handleDeepLink(_ url: URL) {
        guard url.scheme == "morrishealthsync", url.host == "pair" else { return }
        let code = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "code" })?.value
        // Never paired silently from a link: the code is shown and confirmed.
        if let code, !code.isEmpty { pendingCode = code }
    }

    func pair(code: String) async {
        do {
            let token = try await Uploader.pair(code: code)
            Keychain.set(token, for: Key.token)
            paired = true
            pendingCode = nil
            note("Paired with \(Server.host).", ok: true)
            await sync(reason: "paired")
        } catch {
            note(error.localizedDescription, ok: false)
        }
    }

    func unpair() {
        Keychain.delete(Key.token)
        paired = false
        note("Unpaired. Nothing will be sent until this phone is paired again.", ok: true)
    }

    // MARK: Sync

    func sync(reason: String) async {
        guard paired, healthRequested, let token = Keychain.get(Key.token) else { return }
        // Several Health types usually change together and each wakes us.
        // One run at a time; a wake during a run earns exactly one more.
        if syncing {
            runAgain = true
            return
        }
        syncing = true
        defer {
            syncing = false
            if runAgain {
                runAgain = false
                Task { @MainActor in await self.sync(reason: "follow-up") }
            }
        }

        let end = Date()
        let start = HealthReader.hourFloor(end.addingTimeInterval(-48 * 3600))
        var sent = (defaults.dictionary(forKey: Key.sent) as? [String: Double]) ?? [:]
        var sentWorkouts = Set(defaults.stringArray(forKey: Key.sentWorkouts) ?? [])

        var changed: [Bucket] = []
        do {
            for spec in HealthReader.metrics {
                do {
                    for bucket in try await reader.hourly(spec, from: start, to: end) {
                        let previous = sent[bucket.key]
                        if previous == nil || abs((previous ?? 0) - bucket.value) > 0.0005 * max(1, abs(bucket.value)) {
                            changed.append(bucket)
                        }
                    }
                } catch HealthReadError.phoneLocked {
                    throw HealthReadError.phoneLocked
                } catch {
                    // One unreadable type (not granted, no data) must not
                    // stop the others.
                    continue
                }
            }
            let recent = try await reader.workouts(since: end.addingTimeInterval(-7 * 86_400))
            let newWorkouts = recent.filter { !sentWorkouts.contains($0.id) }

            if changed.isEmpty && newWorkouts.isEmpty {
                finish("Up to date (\(reason)).", ok: true, quiet: true)
                return
            }

            let result = try await Uploader.send(buckets: changed, workouts: newWorkouts, token: token)

            for bucket in changed { sent[bucket.key] = bucket.value }
            let cutoff = Int(end.addingTimeInterval(-72 * 3600).timeIntervalSince1970)
            sent = sent.filter { key, _ in
                guard let stamp = key.split(separator: "|").last.flatMap({ Int($0) }) else { return false }
                return stamp >= cutoff
            }
            defaults.set(sent, forKey: Key.sent)
            for w in newWorkouts { sentWorkouts.insert(w.id) }
            defaults.set(Array(sentWorkouts.suffix(600)), forKey: Key.sentWorkouts)

            let workoutsNote = (result.workouts_inserted ?? 0) > 0 ? ", \(result.workouts_inserted ?? 0) workouts" : ""
            finish("Sent \(changed.count) readings\(workoutsNote) (\(reason)).", ok: true, quiet: false)
        } catch HealthReadError.phoneLocked {
            finish("Phone is locked. Will send when it is unlocked.", ok: true, quiet: true)
            scheduleBackgroundRefresh()
        } catch UploadError.unpaired {
            Keychain.delete(Key.token)
            paired = false
            finish("This phone was unpaired on \(Server.host).", ok: false, quiet: false)
        } catch {
            finish("Could not send: \(error.localizedDescription)", ok: false, quiet: false)
            scheduleBackgroundRefresh()
        }
    }

    private func finish(_ message: String, ok: Bool, quiet: Bool) {
        lastMessage = message
        defaults.set(message, forKey: Key.lastMessage)
        if ok {
            lastSyncAt = Date()
            defaults.set(lastSyncAt, forKey: Key.lastSync)
        }
        if !quiet { note(message, ok: ok) }
    }

    private func note(_ text: String, ok: Bool) {
        log.insert(LogLine(at: Date(), text: text, ok: ok), at: 0)
        if log.count > 40 { log = Array(log.prefix(40)) }
        if let data = try? JSONEncoder().encode(log) { defaults.set(data, forKey: Key.log) }
        if !ok { lastMessage = text }
    }

    // MARK: Background refresh (the safety net under background delivery)

    func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    func handleBackgroundRefresh(_ task: BGAppRefreshTask) {
        scheduleBackgroundRefresh()
        let work = Task { @MainActor in
            await self.sync(reason: "background refresh")
            task.setTaskCompleted(success: true)
        }
        task.expirationHandler = { @Sendable in work.cancel() }
    }
}
