/**
 * Safety Intelligence Service for MargDarshak AI.
 *
 * Evaluates safety scores along a route using real Mumbai zone data.
 * Night-time penalty applied after 10 PM.
 * Attaches safetyScore + safetyReasoning to each transport mode.
 */

import safetyZones from "../data/safetyZones.json";

/* ── Haversine (km) ─────────────────────────────────────────────── */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Zone lookup radius (km) ────────────────────────────────────── */
const ZONE_RADIUS_KM = 2.5;

/**
 * Find the nearest safety zone for a given coordinate.
 * Returns the zone object or null.
 */
function findNearestZone(lat, lng) {
    let best = null;
    let bestDist = Infinity;

    for (const zone of safetyZones) {
        const d = haversineKm(lat, lng, zone.lat, zone.lng);
        if (d < ZONE_RADIUS_KM && d < bestDist) {
            bestDist = d;
            best = zone;
        }
    }
    return best;
}

/**
 * Check if current time is "night" (after 10 PM or before 5 AM).
 */
function isNightTime() {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 5;
}

/**
 * Generate intermediate sample points along a straight line between two coords.
 * Returns array of { lat, lng } including start and end.
 */
function sampleRoutePoints(startLat, startLng, endLat, endLng, count = 5) {
    const points = [];
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        points.push({
            lat: startLat + (endLat - startLat) * t,
            lng: startLng + (endLng - startLng) * t,
        });
    }
    return points;
}

/**
 * Evaluate safety along a route (start → end).
 *
 * Returns:
 * {
 *   safetyScore: 1-10 (overall, adjusted for night),
 *   isNight: boolean,
 *   lowSafetyZones: [{ area, safetyScore }],
 *   reasoning: string   ← AI-style reasoning text
 * }
 */
export function evaluateRouteSafety(startLat, startLng, endLat, endLng) {
    const points = sampleRoutePoints(startLat, startLng, endLat, endLng, 6);
    const night = isNightTime();

    const encounteredZones = [];
    const seenAreas = new Set();

    for (const pt of points) {
        const zone = findNearestZone(pt.lat, pt.lng);
        if (zone && !seenAreas.has(zone.area)) {
            seenAreas.add(zone.area);
            encounteredZones.push(zone);
        }
    }

    // If no zones matched, return a neutral score
    if (encounteredZones.length === 0) {
        return {
            safetyScore: 7,
            isNight: night,
            lowSafetyZones: [],
            reasoning: night
                ? "Limited area data. Exercise standard night-time caution."
                : "No specific safety concerns detected for this route.",
        };
    }

    // Average safety score across traversed zones
    const rawAvg =
        encounteredZones.reduce((sum, z) => sum + z.safetyScore, 0) /
        encounteredZones.length;

    // Night penalty: reduce by 2 points if any zone has nightRisk
    const hasNightRisk = encounteredZones.some((z) => z.nightRisk);
    let adjustedScore = rawAvg;
    if (night && hasNightRisk) {
        adjustedScore = Math.max(1, rawAvg - 2);
    }

    // Clamp to integer 1-10
    const finalScore = Math.round(Math.min(10, Math.max(1, adjustedScore)));

    // Collect zones below score 5
    const lowZones = encounteredZones
        .filter((z) => {
            const s = night && z.nightRisk ? Math.max(1, z.safetyScore - 2) : z.safetyScore;
            return s < 5;
        })
        .map((z) => ({
            area: z.area,
            safetyScore: night && z.nightRisk ? Math.max(1, z.safetyScore - 2) : z.safetyScore,
        }));

    // Build reasoning text
    const reasoning = buildReasoning(finalScore, night, hasNightRisk, lowZones, encounteredZones);

    return {
        safetyScore: finalScore,
        isNight: night,
        hasNightRisk,
        lowSafetyZones: lowZones,
        encounteredZones: encounteredZones.map((zone) => ({
            area: zone.area,
            safetyScore: zone.safetyScore,
            nightRisk: !!zone.nightRisk,
        })),
        reasoning,
    };
}

/**
 * Build human-readable AI reasoning string.
 */
function buildReasoning(score, isNight, hasNightRisk, lowZones, allZones) {
    const parts = [];

    if (score >= 8) {
        parts.push("Route passes through well-lit, high-traffic areas.");
    } else if (score >= 6) {
        parts.push("Route is moderately safe with standard precautions.");
    } else if (score >= 4) {
        parts.push("Route adjusted for better lighting and crowd presence.");
    } else {
        parts.push("Caution advised — route passes through low-safety zones.");
    }

    if (isNight && hasNightRisk) {
        parts.push("Night-time penalty applied (after 10 PM). Prefer well-lit main roads.");
    }

    if (lowZones.length > 0) {
        const names = lowZones.map((z) => z.area).join(", ");
        parts.push("Low-safety areas on route: " + names + ".");
        parts.push("Consider cab/auto over walking through these zones.");
    }

    if (allZones.length > 0 && score >= 7) {
        parts.push("Areas like " + allZones[0].area + " are generally safe for travel.");
    }

    return parts.join(" ");
}

/**
 * Attach safety data to an array of transport mode objects.
 * Mutates each mode in-place by adding:
 *   - safetyScore (1-10)
 *   - safetyReasoning (string)
 *
 * Walk mode gets an extra penalty of -1 if score < 5 (unsafe to walk).
 */
export function attachSafetyToModes(modes, startLat, startLng, endLat, endLng) {
    const safety = evaluateRouteSafety(startLat, startLng, endLat, endLng);

    for (const mode of modes) {
        let modeScore = safety.safetyScore;
        let modeReasoning = safety.reasoning;

        // Walk gets extra penalty in low-safety zones
        if (mode.mode === "walk" && safety.lowSafetyZones.length > 0) {
            modeScore = Math.max(1, modeScore - 1);
            modeReasoning += " Walking not recommended through low-safety areas.";
        }

        // Cab/auto is safer at night
        if ((mode.mode === "cab") && safety.isNight) {
            modeScore = Math.min(10, modeScore + 1);
            modeReasoning = "Cab/auto is the safest option at night. " + modeReasoning;
        }

        // Metro is generally safe (enclosed, CCTV)
        if (mode.mode === "metro") {
            modeScore = Math.min(10, Math.max(modeScore, 7));
            if (safety.isNight) {
                modeReasoning = "Metro stations are well-lit with CCTV coverage. " + modeReasoning;
            }
        }

        mode.safetyScore = modeScore;
        mode.safetyReasoning = modeReasoning;
        mode.lowSafetyZones = safety.lowSafetyZones;
        mode.nightRiskOnRoute = safety.hasNightRisk;
        mode.isNightRoute = safety.isNight;
    }

    return safety;
}

export function getSafeRouteOnly(modes = []) {
    if (!Array.isArray(modes) || modes.length === 0) {
        return { safeModes: [], bestMode: null };
    }

    const safeModes = modes.map((mode) => {
        const safetyScore = Number(mode.safetyScore);
        const normalizedSafety = Number.isFinite(safetyScore) ? safetyScore : 5;
        const lowZoneCount = Array.isArray(mode.lowSafetyZones) ? mode.lowSafetyZones.length : 0;
        const isWalk = String(mode.mode).toLowerCase() === "walk";
        const isCab = String(mode.mode).toLowerCase() === "cab";
        const isMetro = String(mode.mode).toLowerCase() === "metro";
        const baseScore = Number.isFinite(mode.personalizedScore)
            ? mode.personalizedScore
            : Number.isFinite(mode.baseScore)
                ? mode.baseScore
                : 0;

        let safeModePenalty = (10 - normalizedSafety) * 12;
        safeModePenalty += lowZoneCount * 10;

        if (mode.nightRiskOnRoute) {
            safeModePenalty += 18;
        }

        if (mode.isNightRoute && isWalk) {
            safeModePenalty += 24;
        }

        if (lowZoneCount > 0 && isWalk) {
            safeModePenalty += 20;
        }

        if (mode.isNightRoute && isCab) {
            safeModePenalty -= 8;
        }

        if (isMetro) {
            safeModePenalty -= 5;
        }

        return {
            ...mode,
            safeModePenalty,
            safeModeScore: baseScore + safeModePenalty,
            safeModeApplied: true,
        };
    });

    let bestMode = null;
    let bestScore = Infinity;

    safeModes.forEach((mode) => {
        if (mode.mode === "walk" && mode.lowSafetyZones?.length > 0) return;
        if (mode.safeModeScore < bestScore) {
            bestScore = mode.safeModeScore;
            bestMode = mode.mode;
        }
    });

    if (!bestMode) {
        safeModes.forEach((mode) => {
            if (mode.safeModeScore < bestScore) {
                bestScore = mode.safeModeScore;
                bestMode = mode.mode;
            }
        });
    }

    return { safeModes, bestMode };
}
