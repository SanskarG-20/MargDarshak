/**
 * Route intelligence service using OpenRouteService (free tier - 2000 req/day).
 * Docs: https://openrouteservice.org/dev/#/api-docs
 *
 * Uses Google Maps logic: ONE real road distance, different speed/cost per mode.
 * All modes share the same distance - only ETA and cost differ.
 */

import { evaluateMetro } from "./metroService.js";
import { evaluateBus } from "./busService.js";
import { evaluateTrain } from "./trainService.js";
import { attachSafetyToModes } from "./safetyService.js";
import { attachEcoScores } from "./ecoScoreService.js";
import { attachCrowdDensityToRoutes } from "./crowdService.js";
import { applyPreferencesToRoutes } from "./personalizationService.js";
import { cacheRoute, getCachedRoute, setOfflineFlag } from "../utils/offlineCache.js";

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY;
const ORS_URL = "https://api.openrouteservice.org/v2/directions";

/**
 * Realistic Indian city speeds (km/h):
 *   Walk    ->  5 km/h
 *   Cab     -> 25 km/h  (city traffic)
 *   Transit -> 18 km/h  (bus/metro with stops)
 */
const SPEED_KMPH = { walk: 5, cab: 25, transit: 18 };

/** Indian cost estimation */
function estimateCost(distanceKm, mode) {
    switch (mode) {
        case "walk":
            return { amount: 0, label: "Free" };
        case "cab": {
            const cost = Math.round(30 + distanceKm * 14);
            return { amount: cost, label: "\u20B9" + cost };
        }
        case "transit": {
            const cost = Math.round(Math.max(10, distanceKm * 3));
            return { amount: cost, label: "\u20B9" + cost };
        }
        default:
            return { amount: 0, label: "N/A" };
    }
}

/** Format seconds into human readable duration */
function formatDuration(seconds) {
    if (seconds < 60) return Math.round(seconds) + "s";
    const mins = Math.round(seconds / 60);
    if (mins < 60) return mins + " min";
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? hrs + "h " + remMins + "m" : hrs + "h";
}

/** Format meters to readable distance */
function formatDistance(meters) {
    if (meters < 1000) return Math.round(meters) + " m";
    return (meters / 1000).toFixed(1) + " km";
}

/**
 * Fetch ONE driving-car route from ORS.
 * Supports both old (string) and new (JWT) API key formats.
 * Returns { distanceM, distanceKm, distanceText, geometry }
 */
async function fetchDrivingRoute(startLat, startLng, endLat, endLng) {
    const url = ORS_URL + "/driving-car?start=" + startLng + "," + startLat + "&end=" + endLng + "," + endLat;

    const res = await fetch(url, {
        headers: {
            "Accept": "application/json, application/geo+json",
            "Authorization": ORS_API_KEY,
        },
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error("[MargDarshak Route] ORS HTTP " + res.status + ":", errText);
        return null;
    }

    const data = await res.json();
    const summary = data.features?.[0]?.properties?.summary;
    const coords = data.features?.[0]?.geometry?.coordinates;

    if (!summary) return null;

    return {
        distanceM: summary.distance,
        distanceKm: summary.distance / 1000,
        distanceText: formatDistance(summary.distance),
        // Convert GeoJSON [lng, lat] -> Leaflet [lat, lng]
        geometry: coords ? coords.map(function(c) { return [c[1], c[0]]; }) : [],
    };
}

/**
 * Fallback: straight-line (haversine) distance when ORS is unavailable.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build mode cards from a distance value.
 */
function buildModes(distanceKm) {
    var modeConfigs = [
        { mode: "walk",    label: "Walk",       speedKmph: SPEED_KMPH.walk    },
        { mode: "cab",     label: "Cab / Auto", speedKmph: SPEED_KMPH.cab     },
    ];

    return modeConfigs.map(function(m) {
        const durationSec = (distanceKm / m.speedKmph) * 3600;
        const cost = estimateCost(distanceKm, m.mode);
        return {
            mode: m.mode,
            label: m.label,
            distance: formatDistance(distanceKm * 1000),
            duration: formatDuration(durationSec),
            durationSec: durationSec,
            cost: cost.label,
            costAmount: cost.amount,
            geometry: [],
        };
    });
}

/**
 * Compare Walk vs Cab vs Transit between two coordinates.
 * Uses ORS for real road distance; falls back to haversine if ORS fails.
 */
export async function compareRoutes(startLat, startLng, endLat, endLng, preferences = null) {
    let distanceKm;
    let geometry = [];
    let usingFallback = false;

    if (!ORS_API_KEY || ORS_API_KEY === "REPLACE_WITH_YOUR_ORS_KEY") {
        usingFallback = true;
    } else {
        try {
            const route = await fetchDrivingRoute(startLat, startLng, endLat, endLng);
            if (route) {
                distanceKm = route.distanceKm;
                geometry = route.geometry;
            } else {
                usingFallback = true;
            }
        } catch (err) {
            console.error("[MargDarshak Route] ORS fetch failed, using fallback:", err);
            usingFallback = true;
        }
    }

    if (usingFallback) {
        // Haversine + 1.3x road factor for city driving
        distanceKm = haversineKm(startLat, startLng, endLat, endLng) * 1.3;
    }

    const modes = buildModes(distanceKm);

    // Attach geometry to cab mode
    modes.forEach(function(m) {
        if (m.mode === "cab") m.geometry = geometry;
    });

    // Evaluate metro option
    try {
        const metro = evaluateMetro(startLat, startLng, endLat, endLng);
        if (metro) {
            modes.push(metro);
        }
    } catch (err) {
        console.warn("[MargDarshak Route] Metro evaluation failed:", err);
    }

    // Evaluate local train option (Mumbai Western/Central/Harbour)
    try {
        const train = evaluateTrain(startLat, startLng, endLat, endLng);
        if (train) {
            modes.push(train);
        }
    } catch (err) {
        console.warn("[MargDarshak Route] Train evaluation failed:", err);
    }

    // Evaluate bus option (replaces generic transit)
    try {
        const bus = evaluateBus(startLat, startLng, endLat, endLng, distanceKm);
        if (bus) {
            modes.push(bus);
        } else {
            // Fallback: generic transit if bus service has no data for this area
            var transitDurSec = (distanceKm / SPEED_KMPH.transit) * 3600;
            var transitCost = estimateCost(distanceKm, "transit");
            modes.push({
                mode: "transit",
                label: "Bus / Transit",
                distance: formatDistance(distanceKm * 1000),
                duration: formatDuration(transitDurSec),
                durationSec: transitDurSec,
                cost: transitCost.label,
                costAmount: transitCost.amount,
                geometry: [],
            });
        }
    } catch (err) {
        console.warn("[MargDarshak Route] Bus evaluation failed:", err);
        var transitDurSec2 = (distanceKm / SPEED_KMPH.transit) * 3600;
        var transitCost2 = estimateCost(distanceKm, "transit");
        modes.push({
            mode: "transit",
            label: "Bus / Transit",
            distance: formatDistance(distanceKm * 1000),
            duration: formatDuration(transitDurSec2),
            durationSec: transitDurSec2,
            cost: transitCost2.label,
            costAmount: transitCost2.amount,
            geometry: [],
        });
    }

    // Attach crowd density intelligence to each mode
    let crowdAwareModes = modes;
    try {
        crowdAwareModes = await attachCrowdDensityToRoutes(modes, {
            startLat,
            startLng,
            endLat,
            endLng,
            distanceKm,
        });
    } catch (err) {
        console.warn("[MargDarshak Route] Crowd evaluation failed:", err);
    }

    // Attach safety intelligence to each mode
    try {
        attachSafetyToModes(crowdAwareModes, startLat, startLng, endLat, endLng);
    } catch (err) {
        console.warn("[MargDarshak Route] Safety evaluation failed:", err);
    }

    // Attach eco travel scores to each mode
    try {
        attachEcoScores(crowdAwareModes, distanceKm);
    } catch (err) {
        console.warn("[MargDarshak Route] Eco score evaluation failed:", err);
    }

    // Baseline score: cost + eta with public transit preference in medium distance
    const scoredInput = crowdAwareModes.map(function(m) {
        var baseScore = m.costAmount + m.durationSec / 60;
        if ((m.mode === "metro" || m.mode === "train") && distanceKm >= 5 && distanceKm <= 25) {
            baseScore -= 5;
        }
        if (Number.isFinite(m.crowdScore)) {
            baseScore += (m.crowdScore - 1) * 2.5;
        }
        return {
            ...m,
            baseScore: baseScore,
        };
    });

    const scoredModes = applyPreferencesToRoutes(scoredInput, preferences);

    // Final best option uses personalized score when available, baseline otherwise.
    let bestMode = null;
    let bestScore = Infinity;

    scoredModes.forEach(function(m) {
        if (m.mode === "walk" && distanceKm > 2) return;
        var score = Number.isFinite(m.personalizedScore) ? m.personalizedScore : m.baseScore;
        if (score < bestScore) {
            bestScore = score;
            bestMode = m.mode;
        }
    });

    // Fallback: if walk > 2km was the only option evaluated, re-evaluate all.
    if (!bestMode) {
        scoredModes.forEach(function(m) {
            var score = Number.isFinite(m.personalizedScore) ? m.personalizedScore : m.baseScore;
            if (score < bestScore) {
                bestScore = score;
                bestMode = m.mode;
            }
        });
    }

    scoredModes.forEach(function(m) { m.isBest = m.mode === bestMode; });

    const result = { modes: scoredModes, distanceKm: distanceKm, usingFallback: usingFallback, error: false };

    // Cache successful route result
    cacheRoute(result);
    return result;
}
