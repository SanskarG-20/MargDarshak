import { supabase } from "./supabaseClient";

const SAFE_MODES = new Set(["metro", "train", "cab", "auto", "transit"]);
const ECO_MODES = new Set(["walk", "metro", "train", "bus", "transit"]);

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function toNumberOrNull(value) {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function round(value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}

function normalizeMode(mode) {
    if (!mode) return null;
    const raw = String(mode).toLowerCase().trim();
    if (raw === "bus / transit") return "transit";
    if (raw === "bus") return "transit";
    if (raw === "taxi") return "cab";
    if (raw === "rickshaw") return "auto";
    return raw;
}

function normalizePreferredModes(preferredModes) {
    if (!preferredModes || typeof preferredModes !== "object") return {};

    const aggregate = {};
    Object.entries(preferredModes).forEach(function([mode, weight]) {
        const normalizedMode = normalizeMode(mode);
        const numericWeight = Number(weight);
        if (!normalizedMode || !Number.isFinite(numericWeight) || numericWeight <= 0) return;
        aggregate[normalizedMode] = (aggregate[normalizedMode] || 0) + numericWeight;
    });

    const total = Object.values(aggregate).reduce(function(sum, value) {
        return sum + value;
    }, 0);

    if (total <= 0) return {};

    const normalized = {};
    Object.entries(aggregate).forEach(function([mode, weight]) {
        normalized[mode] = round(weight / total, 3);
    });

    return normalized;
}

function parseDurationMinutes(durationStr) {
    if (!durationStr) return null;
    const s = String(durationStr).toLowerCase().trim();

    const hm = s.match(/(\d+)\s*h\s*(?:(\d+)\s*m)?/);
    if (hm) return parseInt(hm[1], 10) * 60 + (parseInt(hm[2] || "0", 10) || 0);

    const min = s.match(/(\d+)\s*min/);
    if (min) return parseInt(min[1], 10);

    const sec = s.match(/(\d+)\s*s/);
    if (sec) return Math.max(1, Math.round(parseInt(sec[1], 10) / 60));

    const plain = s.match(/\d+/);
    return plain ? parseInt(plain[0], 10) : null;
}

function parseCostAmount(costStr) {
    if (costStr == null) return null;
    const text = String(costStr).toLowerCase();
    if (text.includes("free")) return 0;
    const m = text.match(/[\d,]+/);
    if (!m) return null;
    const numeric = Number(m[0].replace(/,/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
}

function getCreatedHour(createdAt) {
    if (!createdAt) return null;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.getHours();
}

function getMostFrequentHour(hourCounts) {
    let bestHour = null;
    let bestCount = 0;
    Object.entries(hourCounts).forEach(function([hour, count]) {
        if (count > bestCount) {
            bestCount = count;
            bestHour = Number(hour);
        }
    });
    return Number.isFinite(bestHour) ? bestHour : null;
}

function normalizeStoredPreferences(row) {
    if (!row) return null;

    return {
        user_id: row.user_id,
        preferred_modes: normalizePreferredModes(row.preferred_modes),
        avg_budget: toNumberOrNull(row.avg_budget),
        safety_priority: clamp(toNumberOrNull(row.safety_priority) ?? 0.5, 0, 1),
        eco_priority: clamp(toNumberOrNull(row.eco_priority) ?? 0.5, 0, 1),
        last_updated: row.last_updated || null,
        preferred_time_of_travel: Number.isFinite(Number(row.preferred_time_of_travel))
            ? Number(row.preferred_time_of_travel)
            : null,
    };
}

function deriveRouteBaseScore(route) {
    if (Number.isFinite(route.baseScore)) return Number(route.baseScore);

    const durationMinutes = Number.isFinite(route.durationSec)
        ? Number(route.durationSec) / 60
        : parseDurationMinutes(route.duration);
    const costAmount = Number.isFinite(route.costAmount)
        ? Number(route.costAmount)
        : parseCostAmount(route.cost);

    const score = (costAmount ?? 0) + (durationMinutes ?? 0);
    return Number.isFinite(score) ? score : 0;
}

function hasBehaviorSignal(preferences) {
    if (!preferences) return false;
    const modeCount = Object.keys(preferences.preferred_modes || {}).length;
    return modeCount > 0 || preferences.avg_budget != null || preferences.preferred_time_of_travel != null;
}

export async function getUserPreferences(userId) {
    if (!supabase || !userId) return null;

    const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error("[MargDarshak Personalization] Fetch preferences failed:", error.message);
        return null;
    }

    return normalizeStoredPreferences(data);
}

export async function updatePreferencesFromHistory(userId) {
    if (!supabase || !userId) return null;

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
        console.error("[MargDarshak Personalization] Failed to read saved trips:", savedTripsRes.error.message);
    }
    if (historyRes.error) {
        console.error("[MargDarshak Personalization] Failed to read AI history:", historyRes.error.message);
    }

    const savedTrips = savedTripsRes.data || [];
    const aiHistory = historyRes.data || [];

    const modeCounts = {};
    const hourCounts = {};
    const budgets = [];

    function addMode(rawMode) {
        const mode = normalizeMode(rawMode);
        if (!mode) return;
        modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    }

    function addBudget(rawBudget) {
        const amount = toNumberOrNull(rawBudget);
        if (amount == null || amount < 0) return;
        budgets.push(amount);
    }

    function addHour(hour, createdAt) {
        const direct = Number.isFinite(Number(hour)) ? Number(hour) : null;
        const resolved = direct != null ? direct : getCreatedHour(createdAt);
        if (resolved == null || resolved < 0 || resolved > 23) return;
        hourCounts[resolved] = (hourCounts[resolved] || 0) + 1;
    }

    savedTrips.forEach(function(trip) {
        addMode(trip.preferred_mode);
        addBudget(trip.estimated_cost);
        addHour(trip.travel_hour, trip.created_at);
    });

    aiHistory.forEach(function(row) {
        addMode(row.detected_mode);
        addBudget(row.estimated_cost);
        addHour(row.travel_hour, row.created_at);
    });

    const totalModeEvents = Object.values(modeCounts).reduce(function(sum, count) {
        return sum + count;
    }, 0);

    if (totalModeEvents === 0 && budgets.length === 0 && Object.keys(hourCounts).length === 0) {
        return getUserPreferences(userId);
    }

    const preferredModes = {};
    if (totalModeEvents > 0) {
        Object.entries(modeCounts).forEach(function([mode, count]) {
            preferredModes[mode] = round(count / totalModeEvents, 3);
        });
    }

    const avgBudget = budgets.length > 0
        ? round(budgets.reduce(function(sum, value) { return sum + value; }, 0) / budgets.length, 2)
        : null;

    let safeCount = 0;
    let ecoCount = 0;
    Object.entries(modeCounts).forEach(function([mode, count]) {
        if (SAFE_MODES.has(mode)) safeCount += count;
        if (ECO_MODES.has(mode)) ecoCount += count;
    });

    const safetyPriority = totalModeEvents > 0
        ? round(clamp(0.35 + (safeCount / totalModeEvents) * 0.65, 0, 1), 3)
        : 0.5;
    const ecoPriority = totalModeEvents > 0
        ? round(clamp(0.35 + (ecoCount / totalModeEvents) * 0.65, 0, 1), 3)
        : 0.5;

    const preferredTravelHour = getMostFrequentHour(hourCounts);

    const payload = {
        user_id: userId,
        preferred_modes: preferredModes,
        avg_budget: avgBudget,
        safety_priority: safetyPriority,
        eco_priority: ecoPriority,
        last_updated: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from("user_preferences")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();

    if (error) {
        console.error("[MargDarshak Personalization] Upsert preferences failed:", error.message);
        const existing = await getUserPreferences(userId);
        if (!existing) return null;
        return {
            ...existing,
            preferred_time_of_travel: preferredTravelHour,
        };
    }

    const normalized = normalizeStoredPreferences(data || payload);
    return {
        ...normalized,
        preferred_time_of_travel: preferredTravelHour,
    };
}

export function applyPreferencesToRoutes(routes, preferences) {
    if (!Array.isArray(routes)) return [];

    const normalized = normalizeStoredPreferences(preferences);
    if (!hasBehaviorSignal(normalized)) {
        return routes.map(function(route) {
            const baseScore = deriveRouteBaseScore(route);
            return {
                ...route,
                baseScore: round(baseScore, 2),
                personalizationDelta: 0,
                personalizedScore: round(baseScore, 2),
            };
        });
    }

    return routes.map(function(route) {
        const baseScore = deriveRouteBaseScore(route);
        let delta = 0;

        const mode = normalizeMode(route.mode);
        const modeWeight = normalized.preferred_modes[mode] || 0;
        delta += modeWeight * 18;

        const costAmount = Number.isFinite(route.costAmount)
            ? Number(route.costAmount)
            : parseCostAmount(route.cost);
        if (normalized.avg_budget != null && costAmount != null) {
            if (costAmount <= normalized.avg_budget) {
                delta += 6;
            } else if (costAmount > normalized.avg_budget * 1.3) {
                delta -= 4;
            }
        }

        const safetyScore = toNumberOrNull(route.safetyScore);
        if (safetyScore != null) {
            delta += normalized.safety_priority * ((safetyScore - 5) / 5) * 8;
        }

        const ecoScore = toNumberOrNull(route.ecoScore);
        if (ecoScore != null) {
            delta += normalized.eco_priority * ((ecoScore - 50) / 50) * 6;
        }

        const personalizedScore = baseScore - delta;

        return {
            ...route,
            baseScore: round(baseScore, 2),
            personalizationDelta: round(delta, 2),
            personalizedScore: round(personalizedScore, 2),
        };
    });
}
