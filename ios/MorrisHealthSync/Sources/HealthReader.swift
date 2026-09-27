import Foundation
import HealthKit

/// One Apple Health quantity, and how morrisai.family names and measures it.
/// Names and units match what the dashboard already stores, so rows from this
/// app and rows from Health Auto Export land in the same hourly buckets.
struct MetricSpec {
    let id: HKQuantityTypeIdentifier
    let name: String
    let unit: HKUnit
    let unitLabel: String
    /// Steps and energy add up over an hour; heart rate is averaged.
    let cumulative: Bool
    var scale: Double = 1
}

struct Bucket {
    let name: String
    let unitLabel: String
    let start: Date
    let value: Double
    var key: String { "\(name)|\(Int(start.timeIntervalSince1970))" }
}

struct WorkoutRecord {
    let id: String
    let name: String
    let start: Date
    let end: Date
    let duration: TimeInterval
    let distanceMiles: Double?
    let activeKcal: Double?
    let avgHeartRate: Double?
}

enum HealthReadError: Error {
    /// Apple encrypts Health while the phone is locked. Nothing can be read
    /// until it is unlocked; the sync simply waits.
    case phoneLocked
}

final class HealthReader {
    let store = HKHealthStore()

    static let perMinute = HKUnit.count().unitDivided(by: .minute())

    static let metrics: [MetricSpec] = [
        MetricSpec(id: .stepCount, name: "step_count", unit: .count(), unitLabel: "count", cumulative: true),
        MetricSpec(id: .activeEnergyBurned, name: "active_energy", unit: .kilocalorie(), unitLabel: "kcal", cumulative: true),
        MetricSpec(id: .basalEnergyBurned, name: "basal_energy_burned", unit: .kilocalorie(), unitLabel: "kcal", cumulative: true),
        MetricSpec(id: .distanceWalkingRunning, name: "walking_running_distance", unit: .mile(), unitLabel: "mi", cumulative: true),
        MetricSpec(id: .distanceCycling, name: "cycling_distance", unit: .mile(), unitLabel: "mi", cumulative: true),
        MetricSpec(id: .appleExerciseTime, name: "apple_exercise_time", unit: .minute(), unitLabel: "min", cumulative: true),
        MetricSpec(id: .appleStandTime, name: "apple_stand_time", unit: .minute(), unitLabel: "min", cumulative: true),
        MetricSpec(id: .flightsClimbed, name: "flights_climbed", unit: .count(), unitLabel: "count", cumulative: true),
        MetricSpec(id: .heartRate, name: "heart_rate", unit: perMinute, unitLabel: "count/min", cumulative: false),
        MetricSpec(id: .restingHeartRate, name: "resting_heart_rate", unit: perMinute, unitLabel: "count/min", cumulative: false),
        MetricSpec(id: .walkingHeartRateAverage, name: "walking_heart_rate_average", unit: perMinute, unitLabel: "count/min", cumulative: false),
        MetricSpec(id: .heartRateVariabilitySDNN, name: "hrv", unit: .secondUnit(with: .milli), unitLabel: "ms", cumulative: false),
        MetricSpec(id: .respiratoryRate, name: "respiratory_rate", unit: perMinute, unitLabel: "count/min", cumulative: false),
        MetricSpec(id: .oxygenSaturation, name: "blood_oxygen_saturation", unit: .percent(), unitLabel: "%", cumulative: false, scale: 100),
    ]

    var available: Bool { HKHealthStore.isHealthDataAvailable() }

    var readTypes: Set<HKObjectType> {
        var set = Set<HKObjectType>()
        for m in Self.metrics {
            if let t = HKObjectType.quantityType(forIdentifier: m.id) { set.insert(t) }
        }
        set.insert(HKObjectType.workoutType())
        return set
    }

    var observedTypes: [HKSampleType] {
        var list: [HKSampleType] = Self.metrics.compactMap { HKObjectType.quantityType(forIdentifier: $0.id) }
        list.append(HKObjectType.workoutType())
        return list
    }

    func requestAuthorization() async throws {
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    /// The top of the hour, in UTC, at or before a moment.
    static func hourFloor(_ date: Date) -> Date {
        Date(timeIntervalSince1970: (date.timeIntervalSince1970 / 3600).rounded(.down) * 3600)
    }

    /// Hourly totals or averages for one metric across a window.
    func hourly(_ spec: MetricSpec, from start: Date, to end: Date) async throws -> [Bucket] {
        guard let type = HKObjectType.quantityType(forIdentifier: spec.id) else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        var interval = DateComponents()
        interval.hour = 1
        let options: HKStatisticsOptions = spec.cumulative ? .cumulativeSum : .discreteAverage

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: options,
                anchorDate: start,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, results, error in
                if let error {
                    continuation.resume(throwing: Self.classify(error))
                    return
                }
                var out: [Bucket] = []
                results?.enumerateStatistics(from: start, to: end) { stats, _ in
                    let quantity = spec.cumulative ? stats.sumQuantity() : stats.averageQuantity()
                    guard let quantity else { return }
                    let value = quantity.doubleValue(for: spec.unit) * spec.scale
                    guard value.isFinite, value > 0 else { return }
                    out.append(Bucket(name: spec.name, unitLabel: spec.unitLabel, start: stats.startDate, value: value))
                }
                continuation.resume(returning: out)
            }
            store.execute(query)
        }
    }

    func workouts(since start: Date) async throws -> [WorkoutRecord] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: nil, options: .strictStartDate)
        let samples: [HKSample] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKObjectType.workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: Self.classify(error))
                    return
                }
                continuation.resume(returning: samples ?? [])
            }
            store.execute(query)
        }

        return samples.compactMap { $0 as? HKWorkout }.map { w in
            let walkRun = w.statistics(for: HKQuantityType(.distanceWalkingRunning))?.sumQuantity()?.doubleValue(for: .mile())
            let cycle = w.statistics(for: HKQuantityType(.distanceCycling))?.sumQuantity()?.doubleValue(for: .mile())
            let energy = w.statistics(for: HKQuantityType(.activeEnergyBurned))?.sumQuantity()?.doubleValue(for: .kilocalorie())
            let heart = w.statistics(for: HKQuantityType(.heartRate))?.averageQuantity()?.doubleValue(for: Self.perMinute)
            let indoor = (w.metadata?[HKMetadataKeyIndoorWorkout] as? Bool) ?? false
            return WorkoutRecord(
                id: w.uuid.uuidString,
                name: Self.name(for: w.workoutActivityType, indoor: indoor),
                start: w.startDate,
                end: w.endDate,
                duration: w.duration,
                distanceMiles: walkRun ?? cycle,
                activeKcal: energy,
                avgHeartRate: heart
            )
        }
    }

    private static func classify(_ error: Error) -> Error {
        if let hk = error as? HKError, hk.code == .errorDatabaseInaccessible {
            return HealthReadError.phoneLocked
        }
        return error
    }

    /// The names the dashboard already knows, from Health Auto Export.
    static func name(for type: HKWorkoutActivityType, indoor: Bool) -> String {
        switch type {
        case .walking: return indoor ? "Indoor Walk" : "Walk"
        case .running: return indoor ? "Indoor Run" : "Outdoor Run"
        case .cycling: return indoor ? "Indoor Cycling" : "Outdoor Cycling"
        case .traditionalStrengthTraining: return "Traditional Strength Training"
        case .functionalStrengthTraining: return "Functional Strength Training"
        case .highIntensityIntervalTraining: return "High Intensity Interval Training"
        case .flexibility: return "Flexibility"
        case .coreTraining: return "Core Training"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .elliptical: return "Elliptical"
        case .rowing: return "Rowing"
        case .stairClimbing: return "Stair Climbing"
        case .hiking: return "Hiking"
        case .swimming: return "Swimming"
        case .cooldown: return "Cooldown"
        case .mindAndBody: return "Mind and Body"
        case .golf: return "Golf"
        case .basketball: return "Basketball"
        case .tennis: return "Tennis"
        case .dance, .cardioDance: return "Dance"
        case .mixedCardio: return "Mixed Cardio"
        default: return "Other"
        }
    }
}
