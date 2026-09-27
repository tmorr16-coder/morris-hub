import Foundation
import UIKit

/// Talks to morrisai.family. The host is fixed: a link that could point this
/// app at another server would be a way to siphon someone's health data.
enum Server {
    static let host = "morrisai.family"
    static var pairURL: URL { URL(string: "https://\(host)/api/health/device/pair")! }
    static var uploadURL: URL { URL(string: "https://\(host)/api/health/webhooks/apple-health")! }
}

struct UploadResult: Decodable {
    let metrics_inserted: Int?
    let workouts_inserted: Int?
}

enum UploadError: LocalizedError {
    case notPaired
    case unpaired            // the server no longer recognises this phone
    case server(Int, String)

    var errorDescription: String? {
        switch self {
        case .notPaired: return "This phone is not paired yet."
        case .unpaired: return "This phone was unpaired on morrisai.family. Pair it again."
        case .server(let code, let message): return "Server said \(code): \(message)"
        }
    }
}

enum Uploader {
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()

    static func pair(code: String) async throws -> String {
        var request = URLRequest(url: Server.pairURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let label = await UIDevice.current.name
        request.httpBody = try JSONSerialization.data(withJSONObject: ["code": code, "label": label])
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard status == 200, let token = json?["token"] as? String else {
            throw UploadError.server(status, (json?["error"] as? String) ?? "Pairing failed")
        }
        return token
    }

    static func send(buckets: [Bucket], workouts: [WorkoutRecord], token: String) async throws -> UploadResult {
        // Grouped the way the server already reads Health Auto Export.
        var groups: [String: (unit: String, points: [[String: Any]])] = [:]
        for b in buckets {
            var g = groups[b.name] ?? (unit: b.unitLabel, points: [])
            g.points.append(["date": iso.string(from: b.start), "qty": b.value, "units": b.unitLabel])
            groups[b.name] = g
        }
        let metrics: [[String: Any]] = groups.map { name, g in
            ["name": name, "units": g.unit, "data": g.points]
        }
        let workoutRows: [[String: Any]] = workouts.map { w in
            var row: [String: Any] = [
                "id": w.id,
                "name": w.name,
                "start": iso.string(from: w.start),
                "end": iso.string(from: w.end),
                "duration": w.duration,
            ]
            if let d = w.distanceMiles { row["distance"] = ["qty": d, "units": "mi"] }
            if let e = w.activeKcal { row["activeEnergyBurned"] = ["qty": e, "units": "kcal"] }
            if let h = w.avgHeartRate { row["avgHeartRate"] = ["qty": h, "units": "count/min"] }
            return row
        }
        let body: [String: Any] = [
            "data": ["metrics": metrics, "workouts": workoutRows],
            "client": ["app": "morris-health-sync", "version": "1.0"],
        ]

        var request = URLRequest(url: Server.uploadURL)
        request.httpMethod = "POST"
        request.timeoutInterval = 25
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw UploadError.unpaired }
        guard status == 200 else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw UploadError.server(status, String(text.prefix(160)))
        }
        return (try? JSONDecoder().decode(UploadResult.self, from: data)) ?? UploadResult(metrics_inserted: nil, workouts_inserted: nil)
    }
}
