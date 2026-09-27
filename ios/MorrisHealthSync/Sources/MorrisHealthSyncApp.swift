import SwiftUI
import UIKit
import BackgroundTasks

// Morris Health Sync
//
// One job: when Apple Health gets new data — a workout ends on the watch, the
// hour's steps land — send it to morrisai.family. iOS wakes the app for that
// through HealthKit background delivery; nobody has to open anything.

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Both registrations must happen on every launch, including the silent
        // ones iOS performs to hand over a HealthKit update.
        BGTaskScheduler.shared.register(forTaskWithIdentifier: SyncEngine.refreshTaskId, using: nil) { @Sendable task in
            guard let refresh = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            Task { @MainActor in SyncEngine.shared.handleBackgroundRefresh(refresh) }
        }
        SyncEngine.shared.start()
        return true
    }
}

@main
struct MorrisHealthSyncApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var engine = SyncEngine.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(engine)
                .onOpenURL { url in engine.handleDeepLink(url) }
        }
        .onChange(of: scenePhase) { _, phase in
            switch phase {
            case .active:
                Task { await engine.sync(reason: "opened") }
            case .background:
                engine.scheduleBackgroundRefresh()
            default:
                break
            }
        }
    }
}
