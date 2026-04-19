import { supabase } from "./supabaseClient";

const MODE_TIME_SAVED = {
    walk: 5,
    cab: 0,
    auto: 3,
    metro: 18,
    train: 22,
    transit: 10,
};

const MODE_CO2_SAVED = {
    walk: 180,
    cab: 0,
    auto: 35,
    metro: 140,
    train: 160,
    transit: 90,
};

const MODE_LABELS = {
    walk: "Walk",
    cab: "Cab / Auto",
    auto: "Auto",
    metro: "Metro",
    train: "Train",
    transit: "Bus / Transit",
};

function round(value, decimals = 0) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

function normalizeMode(mode) {
    if (!mode) return null;
    const raw = String(mode).toLowerCase().trim();
    if (raw === "bus") return "transit";
    if (raw === "bus / transit") return "transit";
    if (raw === "taxi") return "cab";
    return raw;
}

function getTravelHour(entry) {
    const directHour = Number(entry?.travel_hour);
    if (Number.isInteger(directHour) && directHour >= 0 && directHour <= 23) {
        return directHour;
    }

    const createdAt = entry?.created_at ? new Date(entry.created_at) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
        return createdAt.getHours();
    }

    return null;
}

function buildTimeBuckets(events) {
    const buckets = [
        { key: "morning", label: "Morning", hours: [5, 11], count: 0 },
        { key: "afternoon", label: "Afternoon", hours: [11, 17], count: 0 },
        { key: "evening", label: "Evening", hours: [17, 22], count: 0 },
        { key: "night", label: "Night", hours: [22, 5], count: 0 },
    ];

    events.forEach((entry) => {
        const hour = getTravelHour(entry);
        if (hour == null) return;

        if (hour >= 5 && hour < 11) {
            buckets[0].count += 1;
        } else if (hour >= 11 && hour < 17) {
            buckets[1].count += 1;
        } else if (hour >= 17 && hour < 22) {
            buckets[2].count += 1;
        } else {
            buckets[3].count += 1;
        }
    });

    const peak = buckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best), buckets[0]);
    return { buckets, peakLabel: peak.count > 0 ? peak.label : null };
}

function buildModeShare(events) {
    const counts = {};

    events.forEach((entry) => {
        const mode = normalizeMode(entry.mode);
        if (!mode) return;
        counts[mode] = (counts[mode] || 0) + 1;
    });

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const breakdown = Object.entries(counts)
        .map(([mode, count]) => ({
            mode,
            label: MODE_LABELS[mode] || mode,
            count,
            share: total > 0 ? round((count / total) * 100, 1) : 0,
        }))
        .sort((a, b) => b.count - a.count);

    return {
        breakdown,
        topMode: breakdown[0]?.label || null,
    };
}

function buildAnalytics(savedTrips, aiHistory) {
    const tripEvents = [
        ...savedTrips.map((trip) => ({
            source: "saved",
            mode: trip.preferred_mode,
            estimated_cost: trip.estimated_cost,
            travel_hour: trip.travel_hour,
            created_at: trip.created_at,
        })),
        ...aiHistory
            .filter((row) => row.detected_mode || row.estimated_cost != null)
            .map((row) => ({
                source: "ai",
                mode: row.detected_mode,
                estimated_cost: row.estimated_cost,
                travel_hour: row.travel_hour,
                created_at: row.created_at,
            })),
    ];

    const totalTrips = tripEvents.length;
    const costs = tripEvents
        .map((entry) => Number(entry.estimated_cost))
        .filter((value) => Number.isFinite(value) && value >= 0);
    const avgCost = costs.length > 0
        ? round(costs.reduce((sum, value) => sum + value, 0) / costs.length, 0)
        : 0;

    const timeSavedMinutes = round(
        tripEvents.reduce((sum, entry) => {
            const mode = normalizeMode(entry.mode);
            return sum + (MODE_TIME_SAVED[mode] || 0);
        }, 0),
        0
    );

    const co2SavedGrams = round(
        tripEvents.reduce((sum, entry) => {
            const mode = normalizeMode(entry.mode);
            return sum + (MODE_CO2_SAVED[mode] || 0);
        }, 0),
        0
    );

    const modeShare = buildModeShare(tripEvents);
    const timeProfile = buildTimeBuckets(tripEvents);

    return {
        totalTrips,
        avgCost,
        timeSavedMinutes,
        co2SavedKg: round(co2SavedGrams / 1000, 1),
        topMode: modeShare.topMode,
        peakTravelWindow: timeProfile.peakLabel,
        modeBreakdown: modeShare.breakdown,
        timeBuckets: timeProfile.buckets,
        savedTripsCount: savedTrips.length,
        aiPlannedCount: aiHistory.length,
    };
}

export async function getUserTravelAnalytics(userId) {
    if (!supabase || !userId) {
        return {
            totalTrips: 0,
            avgCost: 0,
            timeSavedMinutes: 0,
            co2SavedKg: 0,
            topMode: null,
            peakTravelWindow: null,
            modeBreakdown: [],
            timeBuckets: [],
            savedTripsCount: 0,
            aiPlannedCount: 0,
        };
    }

    const [savedTripsRes, historyRes] = await Promise.all([
        supabase
            .from("saved_trips")
            .select("preferred_mode, estimated_cost, travel_hour, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200),
        supabase
            .from("ai_history")
            .select("detected_mode, estimated_cost, travel_hour, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(200),
    ]);

    if (savedTripsRes.error) {
        console.error("[MargDarshak Analytics] Failed to load saved trips:", savedTripsRes.error.message);
    }
    if (historyRes.error) {
        console.error("[MargDarshak Analytics] Failed to load AI history:", historyRes.error.message);
    }

    return buildAnalytics(savedTripsRes.data || [], historyRes.data || []);
}
