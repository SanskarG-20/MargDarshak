import { compareRoutes } from "./routeService";

const DEVIATION_THRESHOLD_METERS = 300;
const DELAY_THRESHOLD_MINUTES = 8;

function toRadians(value) {
    return (value * Math.PI) / 180;
}

function haversineMeters(a, b) {
    if (
        !Number.isFinite(a?.lat) ||
        !Number.isFinite(a?.lng) ||
        !Number.isFinite(b?.lat) ||
        !Number.isFinite(b?.lng)
    ) {
        return Infinity;
    }

    const earthRadius = 6371000;
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function pointToSegmentMeters(point, start, end) {
    if (!start || !end) return Infinity;

    const avgLat = toRadians((start.lat + end.lat + point.lat) / 3);
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(avgLat);

    const px = point.lng * metersPerDegLng;
    const py = point.lat * metersPerDegLat;
    const sx = start.lng * metersPerDegLng;
    const sy = start.lat * metersPerDegLat;
    const ex = end.lng * metersPerDegLng;
    const ey = end.lat * metersPerDegLat;

    const dx = ex - sx;
    const dy = ey - sy;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
        return Math.hypot(px - sx, py - sy);
    }

    const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lengthSq));
    const closestX = sx + t * dx;
    const closestY = sy + t * dy;

    return Math.hypot(px - closestX, py - closestY);
}

function parseDurationMinutes(durationText, durationSeconds) {
    if (Number.isFinite(durationSeconds)) {
        return Math.round(durationSeconds / 60);
    }

    if (!durationText) return null;
    const text = String(durationText).toLowerCase().trim();

    const hm = text.match(/(\d+)\s*h\s*(?:(\d+)\s*m)?/);
    if (hm) {
        return parseInt(hm[1], 10) * 60 + parseInt(hm[2] || "0", 10);
    }

    const mins = text.match(/(\d+)\s*min/);
    if (mins) return parseInt(mins[1], 10);

    const secs = text.match(/(\d+)\s*s/);
    if (secs) return Math.max(1, Math.round(parseInt(secs[1], 10) / 60));

    return null;
}

function parseCostAmount(cost) {
    if (cost == null) return null;
    const text = String(cost).toLowerCase();
    if (text.includes("free")) return 0;
    const match = text.match(/[\d,]+/);
    if (!match) return null;
    const amount = Number(match[0].replace(/,/g, ""));
    return Number.isFinite(amount) ? amount : null;
}

function getJourneyPath(journey) {
    if (!journey) return [];

    if (Array.isArray(journey.geometry) && journey.geometry.length > 1) {
        return journey.geometry
            .filter((point) => Array.isArray(point) && point.length === 2)
            .map((point) => ({ lat: point[0], lng: point[1] }));
    }

    if (journey.origin && journey.destination) {
        return [journey.origin, journey.destination];
    }

    return [];
}

function getBestRoute(routes) {
    if (!Array.isArray(routes) || routes.length === 0) return null;
    return routes.find((route) => route.isBest) || routes[0];
}

function calculateImprovement(currentBest, nextBest) {
    if (!currentBest || !nextBest) return { minutes: 0, cost: 0, safety: 0 };

    const currentMinutes = parseDurationMinutes(currentBest.duration, currentBest.durationSec);
    const nextMinutes = parseDurationMinutes(nextBest.duration, nextBest.durationSec);
    const currentCost = Number.isFinite(currentBest.costAmount)
        ? currentBest.costAmount
        : parseCostAmount(currentBest.cost);
    const nextCost = Number.isFinite(nextBest.costAmount)
        ? nextBest.costAmount
        : parseCostAmount(nextBest.cost);

    return {
        minutes: Number.isFinite(currentMinutes) && Number.isFinite(nextMinutes)
            ? currentMinutes - nextMinutes
            : 0,
        cost: Number.isFinite(currentCost) && Number.isFinite(nextCost)
            ? currentCost - nextCost
            : 0,
        safety: Number.isFinite(currentBest.safetyScore) && Number.isFinite(nextBest.safetyScore)
            ? nextBest.safetyScore - currentBest.safetyScore
            : 0,
    };
}

async function getDelayFromPublicApis() {
    // Public transport APIs are not wired in this project yet.
    // Keep the async boundary so we can drop in a real provider later.
    return null;
}

function buildJourneyFromSuggestion(position, destination, result, trigger) {
    const bestRoute = getBestRoute(result?.modes || []);
    const routeWithGeometry = (result?.modes || []).find((route) => Array.isArray(route.geometry) && route.geometry.length > 1);

    return {
        id: "journey-" + Date.now(),
        origin: { lat: position.lat, lng: position.lng },
        destination: {
            name: destination.name,
            lat: destination.lat,
            lng: destination.lng,
        },
        routes: result?.modes || [],
        bestRoute: bestRoute,
        geometry: bestRoute?.geometry?.length > 1
            ? bestRoute.geometry
            : routeWithGeometry?.geometry || [],
        usingFallback: !!result?.usingFallback,
        startedAt: Date.now(),
        lastKnownPosition: { lat: position.lat, lng: position.lng },
        status: "active",
        rerouteReason: trigger,
        safeMode: !!result?.safeMode,
    };
}

export function monitorRouteDeviation(currentPosition, journey) {
    if (!currentPosition || !journey) {
        return { deviationMeters: 0, shouldRecalculate: false, reason: null };
    }

    const path = getJourneyPath(journey);
    if (path.length < 2) {
        return { deviationMeters: 0, shouldRecalculate: false, reason: null };
    }

    let minDistance = Infinity;
    for (let i = 0; i < path.length - 1; i += 1) {
        const segmentDistance = pointToSegmentMeters(currentPosition, path[i], path[i + 1]);
        if (segmentDistance < minDistance) {
            minDistance = segmentDistance;
        }
    }

    return {
        deviationMeters: Math.round(minDistance),
        shouldRecalculate: minDistance > DEVIATION_THRESHOLD_METERS,
        reason: minDistance > DEVIATION_THRESHOLD_METERS
            ? "You're off the planned path."
            : null,
    };
}

export async function detectDelays(journey, currentPosition) {
    if (!journey || !currentPosition) {
        return { delayMinutes: 0, shouldRecalculate: false, source: "none" };
    }

    const apiDelay = await getDelayFromPublicApis(journey);
    if (apiDelay && Number.isFinite(apiDelay.delayMinutes)) {
        return {
            delayMinutes: apiDelay.delayMinutes,
            shouldRecalculate: apiDelay.delayMinutes > DELAY_THRESHOLD_MINUTES,
            source: "api",
            reason: apiDelay.reason || "Live network delay detected.",
        };
    }

    const bestRoute = journey.bestRoute || getBestRoute(journey.routes);
    const startedAt = Number.isFinite(journey.startedAt) ? journey.startedAt : Date.now();
    const elapsedMinutes = Math.max(0, (Date.now() - startedAt) / 60000);
    const expectedMinutes = parseDurationMinutes(bestRoute?.duration, bestRoute?.durationSec);
    const initialDistance = haversineMeters(journey.origin, journey.destination);
    const remainingDistance = haversineMeters(currentPosition, journey.destination);

    if (!Number.isFinite(expectedMinutes) || !Number.isFinite(initialDistance) || initialDistance <= 0) {
        return { delayMinutes: 0, shouldRecalculate: false, source: "simulated" };
    }

    const progressRatio = Math.max(0, Math.min(1, (initialDistance - remainingDistance) / initialDistance));
    const expectedProgressRatio = Math.max(0, Math.min(1, elapsedMinutes / expectedMinutes));

    let simulatedDelay = 0;
    if (expectedProgressRatio > progressRatio) {
        simulatedDelay += Math.round((expectedProgressRatio - progressRatio) * expectedMinutes);
    }

    const crowdPenalty = bestRoute?.crowdLevel === "packed"
        ? 5
        : bestRoute?.crowdLevel === "high"
            ? 3
            : 0;
    const peakPenalty = bestRoute?.peakWarning ? 3 : 0;

    simulatedDelay += crowdPenalty + peakPenalty;

    return {
        delayMinutes: simulatedDelay,
        shouldRecalculate: simulatedDelay > DELAY_THRESHOLD_MINUTES,
        source: "simulated",
        reason: simulatedDelay > DELAY_THRESHOLD_MINUTES
            ? "Your current trip looks slower than expected."
            : null,
    };
}

export async function suggestBetterRoute(currentPosition, journey, preferences = null) {
    if (!currentPosition || !journey?.destination?.lat || !journey?.destination?.lng) {
        return null;
    }

    const comparison = await compareRoutes(
        currentPosition.lat,
        currentPosition.lng,
        journey.destination.lat,
        journey.destination.lng,
        preferences,
        { safeMode: !!journey.safeMode }
    );

    if (comparison?.error || !comparison?.modes?.length) {
        return null;
    }

    const currentBest = journey.bestRoute || getBestRoute(journey.routes);
    const nextBest = getBestRoute(comparison.modes);
    const improvement = calculateImprovement(currentBest, nextBest);

    const modeChanged = currentBest?.mode !== nextBest?.mode;
    const materiallyBetter =
        improvement.minutes >= 5 ||
        improvement.cost >= 20 ||
        improvement.safety >= 1.5;

    if (!modeChanged && !materiallyBetter) {
        return null;
    }

    let summary = "Better route found — switch?";
    if (improvement.minutes >= 5) {
        summary = `Better route found — save ${improvement.minutes} min?`;
    } else if (improvement.cost >= 20) {
        summary = `Better route found — save ₹${improvement.cost}?`;
    } else if (improvement.safety >= 1.5) {
        summary = "Better route found — safer option available.";
    }

    return {
        summary,
        improvement,
        nextBest,
        journey: buildJourneyFromSuggestion(currentPosition, journey.destination, comparison, "live-suggestion"),
    };
}
