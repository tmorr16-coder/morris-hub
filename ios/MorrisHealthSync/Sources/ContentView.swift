import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var engine: SyncEngine
    @State private var code = ""
    @State private var confirmUnpair = false

    var body: some View {
        NavigationStack {
            List {
                statusSection
                if !engine.paired { pairingSection }
                if engine.paired && !engine.healthRequested { healthSection }
                if engine.paired && engine.healthRequested { syncSection }
                if !engine.log.isEmpty { logSection }
                aboutSection
            }
            .navigationTitle("Morris Health")
            .alert("Pair this iPhone?", isPresented: Binding(
                get: { engine.pendingCode != nil },
                set: { if !$0 { engine.pendingCode = nil } }
            )) {
                Button("Pair") {
                    if let c = engine.pendingCode { Task { await engine.pair(code: c) } }
                }
                Button("Cancel", role: .cancel) { engine.pendingCode = nil }
            } message: {
                Text("Your Apple Health data will be sent to your account on \(Server.host). Code \(engine.pendingCode ?? "").")
            }
            .confirmationDialog("Unpair this iPhone?", isPresented: $confirmUnpair, titleVisibility: .visible) {
                Button("Unpair", role: .destructive) { engine.unpair() }
            } message: {
                Text("Nothing more will be sent until it is paired again.")
            }
        }
    }

    private var statusSection: some View {
        Section {
            HStack(spacing: 12) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)
                VStack(alignment: .leading, spacing: 2) {
                    Text(statusTitle).font(.headline)
                    Text(engine.lastMessage).font(.footnote).foregroundStyle(.secondary)
                }
            }
            if let at = engine.lastSyncAt {
                LabeledContent("Last sync", value: at.formatted(.relative(presentation: .named)))
            }
        }
    }

    private var statusTitle: String {
        if !engine.paired { return "Not paired" }
        if !engine.healthRequested { return "Needs Health access" }
        return engine.syncing ? "Syncing…" : "Syncing automatically"
    }

    private var statusColor: Color {
        if !engine.paired || !engine.healthRequested { return .orange }
        return .green
    }

    private var pairingSection: some View {
        Section {
            TextField("Pairing code, e.g. K7F3-9QXD", text: $code)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .font(.system(.title3, design: .monospaced))
            Button("Pair this iPhone") {
                Task { await engine.pair(code: code) }
            }
            .disabled(code.filter { $0.isLetter || $0.isNumber }.count != 8)
        } header: {
            Text("Pair")
        } footer: {
            Text("On \(Server.host) open Health → Settings → Integrations and tap “Pair an iPhone”. Open that page on this phone and the code fills itself in.")
        }
    }

    private var healthSection: some View {
        Section {
            Button("Allow access to Apple Health") {
                Task { await engine.requestHealthAccess() }
            }
        } footer: {
            Text("Turn everything on in the sheet that follows. This app reads only; it never writes to Apple Health.")
        }
    }

    private var syncSection: some View {
        Section {
            Button {
                Task { await engine.sync(reason: "manual") }
            } label: {
                HStack {
                    Text("Sync now")
                    Spacer()
                    if engine.syncing { ProgressView() }
                }
            }
            .disabled(engine.syncing)
            Button("Unpair this iPhone", role: .destructive) { confirmUnpair = true }
        } footer: {
            Text("You should not need this button. Apple Health wakes the app when the watch records something new; if the phone is locked at that moment, it sends as soon as you unlock it.")
        }
    }

    private var logSection: some View {
        Section("Recent") {
            ForEach(engine.log.prefix(12)) { line in
                VStack(alignment: .leading, spacing: 2) {
                    Text(line.text)
                        .font(.footnote)
                        .foregroundStyle(line.ok ? Color.primary : Color.red)
                    Text(line.at.formatted(date: .abbreviated, time: .shortened))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var aboutSection: some View {
        Section {
            Text("For it to keep running: leave Background App Refresh on for this app, keep Low Power Mode off when you can, and do not swipe the app away in the app switcher — iOS stops waking an app its owner has force-quit.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }
}
