const CROWD_LABELS = {
    1: { level: "low", badge: "\uD83D\uDFE2 Low" },
    2: { level: "low", badge: "\uD83D\uDFE2 Low" },
    3: { level: "moderate", badge: "\uD83D\uDFE1 Medium" },
    4: { level: "high", badge: "\uD83D\uDD34 High" },
    5: { level: "packed", badge: "\uD83D\uDD34 High" },
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getHour() {
    return new Date().getHours();
}

function getCityBucket(lat, lng) {
    if (lat >= 18.87 && lat <= 19.45 && lng >= 72.75 && lng <= 73.15) {
        return "mumbai";
    }
    return "generic";
}

function getLocationPressure(lat, lng) {
    const city = getCityBucket(lat, lng);
    if (city !== "mumbai") return 0;

    const denseHotspots = [
        { lat: 19.0178, lng: 72.8424, weight: 1.1 }, // Dadar
        { lat: 19.0544, lng: 72.8402, weight: 0.8 }, // Bandra
        { lat: 19.1197, lng: 72.8464, weight: 0.9 }, // Andheri
        { lat: 19.0640, lng: 72.8660, weight: 0.7 }, // BKC
        { lat: 19.0866, lng: 72.9085, weight: 0.6 }, // Ghatkopar
    ];

    let pressure = 0;
    denseHotspots.forEach((spot) => {
        const latDiff = Math.abs(lat - spot.lat);
        const lngDiff = Math.abs(lng - spot.lng);
        if (latDiff < 0.04 && lngDiff < 0.04) {
            pressure += spot.weight;
        }
    });

    return pressure;
}

function getPeakPressure(hour) {
    if ((hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 20)) return 2;
    if ((hour >= 7 && hour <= 11) || (hour >= 17 && hour <= 21)) return 1;
    return 0;
}

function getModePressure(mode) {
    switch (mode) {
        case "train":
            return 2;
        case "metro":
            return 1.5;
        case "transit":
        case "bus":
            return 1.2;
        case "cab":
            return 0.2;
        case "walk":
            return -0.5;
        default:
            return 0.5;
    }
}

async function getTransitCrowdFromPublicApi() {
    // Transit crowd APIs are not configured in this project yet.
    // Keep this async seam for future GTFS-RT or city open-data feeds.
    return null;
}

export function getCrowdDescriptor(score) {
    return CROWD_LABELS[clamp(Math.round(score || 3), 1, 5)] || CROWD_LABELS[3];
}

export async function estimateCrowdDensity(route, context = {}) {
    const apiSignal = await getTransitCrowdFromPublicApi(route, context);
    if (apiSignal && Number.isFinite(apiSignal.score)) {
        const score = clamp(apiSignal.score, 1, 5);
        const descriptor = getCrowdDescriptor(score);
        return {
            crowdScore: score,
            crowdLevel: descriptor.level,
            crowdBadge: descriptor.badge,
            crowdSource: "api",
        };
    }

    const hour = getHour();
    const startLat = Number(context.startLat);
    const startLng = Number(context.startLng);
    const endLat = Number(context.endLat);
    const endLng = Number(context.endLng);

    const base =
        2 +
        getPeakPressure(hour) +
        getModePressure(String(route?.mode || "").toLowerCase()) +
        getLocationPressure(startLat, startLng) * 0.7 +
        getLocationPressure(endLat, endLng) * 0.5;

    const score = clamp(Math.round(base), 1, 5);
    const descriptor = getCrowdDescriptor(score);

    return {
        crowdScore: score,
        crowdLevel: descriptor.level,
        crowdBadge: descriptor.badge,
        crowdSource: "heuristic",
    };
}

export async function attachCrowdDensityToRoutes(routes, context = {}) {
    if (!Array.isArray(routes) || routes.length === 0) return routes || [];

    const enriched = await Promise.all(routes.map(async (route) => {
        const crowd = await estimateCrowdDensity(route, context);
        return {
            ...route,
            crowdScore: crowd.crowdScore,
            crowdLevel: route.crowdLevel || crowd.crowdLevel,
            crowdBadge: crowd.crowdBadge,
            crowdSource: crowd.crowdSource,
        };
    }));

    return enriched;
}
