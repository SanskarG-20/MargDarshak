import { haversineKm } from "../utils/geo";

/**
 * Mumbai Local Train intelligence service — Western & Central Railway.
 * Real station data, nearest-station lookup, ETA, and fare estimation.
 */

// ── Mumbai Local Train Dataset ──────────────────────────────────────────

const MUMBAI_LOCAL = {
    city: "Mumbai",
    bounds: { latMin: 18.87, latMax: 19.45, lngMin: 72.75, lngMax: 73.05 },
    lines: [
        {
            id: "WR",
            name: "Western Railway",
            color: "#1565c0",
            frequency: "3-5 min",
            hours: "4:00 AM - 1:30 AM",
            stations: [
                { name: "Churchgate",         lat: 18.9357, lng: 72.8273 },
                { name: "Marine Lines",       lat: 18.9440, lng: 72.8233 },
                { name: "Charni Road",        lat: 18.9514, lng: 72.8194 },
                { name: "Grant Road",         lat: 18.9630, lng: 72.8170 },
                { name: "Mumbai Central",     lat: 18.9694, lng: 72.8195 },
                { name: "Mahalaxmi",          lat: 18.9830, lng: 72.8212 },
                { name: "Lower Parel",        lat: 18.9930, lng: 72.8290 },
                { name: "Elphinstone Road",   lat: 19.0015, lng: 72.8338 },
                { name: "Dadar",              lat: 19.0178, lng: 72.8424 },
                { name: "Matunga Road",       lat: 19.0274, lng: 72.8442 },
                { name: "Mahim Junction",     lat: 19.0395, lng: 72.8402 },
                { name: "Bandra",             lat: 19.0544, lng: 72.8402 },
                { name: "Khar Road",          lat: 19.0650, lng: 72.8365 },
                { name: "Santacruz",          lat: 19.0800, lng: 72.8386 },
                { name: "Vile Parle",         lat: 19.0970, lng: 72.8438 },
                { name: "Andheri",            lat: 19.1197, lng: 72.8464 },
                { name: "Jogeshwari",         lat: 19.1365, lng: 72.8490 },
                { name: "Ram Mandir",         lat: 19.1470, lng: 72.8510 },
                { name: "Goregaon",           lat: 19.1655, lng: 72.8490 },
                { name: "Malad",              lat: 19.1865, lng: 72.8480 },
                { name: "Kandivali",          lat: 19.2060, lng: 72.8530 },
                { name: "Borivali",           lat: 19.2290, lng: 72.8568 },
                { name: "Dahisar",            lat: 19.2505, lng: 72.8595 },
                { name: "Mira Road",          lat: 19.2812, lng: 72.8645 },
                { name: "Bhayandar",          lat: 19.3010, lng: 72.8510 },
                { name: "Naigaon",            lat: 19.3500, lng: 72.8470 },
                { name: "Vasai Road",         lat: 19.3665, lng: 72.8326 },
                { name: "Nallasopara",        lat: 19.4150, lng: 72.8180 },
                { name: "Virar",              lat: 19.4559, lng: 72.8105 },
            ],
        },
        {
            id: "CR",
            name: "Central Railway",
            color: "#d32f2f",
            frequency: "3-5 min",
            hours: "4:00 AM - 1:30 AM",
            stations: [
                { name: "CSMT",               lat: 18.9400, lng: 72.8356 },
                { name: "Masjid Bunder",      lat: 18.9493, lng: 72.8397 },
                { name: "Sandhurst Road",     lat: 18.9580, lng: 72.8390 },
                { name: "Byculla",            lat: 18.9780, lng: 72.8340 },
                { name: "Chinchpokli",        lat: 18.9870, lng: 72.8335 },
                { name: "Currey Road",        lat: 18.9960, lng: 72.8340 },
                { name: "Parel",              lat: 19.0050, lng: 72.8370 },
                { name: "Dadar",              lat: 19.0178, lng: 72.8424 },
                { name: "Matunga",            lat: 19.0274, lng: 72.8540 },
                { name: "Sion",               lat: 19.0436, lng: 72.8618 },
                { name: "Kurla",              lat: 19.0650, lng: 72.8790 },
                { name: "Vidyavihar",         lat: 19.0790, lng: 72.8880 },
                { name: "Ghatkopar",          lat: 19.0866, lng: 72.9085 },
                { name: "Vikhroli",           lat: 19.1003, lng: 72.9190 },
                { name: "Kanjurmarg",         lat: 19.1125, lng: 72.9290 },
                { name: "Bhandup",            lat: 19.1310, lng: 72.9340 },
                { name: "Nahur",              lat: 19.1410, lng: 72.9360 },
                { name: "Mulund",             lat: 19.1722, lng: 72.9560 },
                { name: "Thane",              lat: 19.1860, lng: 72.9753 },
                { name: "Kalva",              lat: 19.2053, lng: 73.0095 },
                { name: "Dombivli",           lat: 19.2200, lng: 73.0870 },
                { name: "Kalyan",             lat: 19.2350, lng: 73.1310 },
            ],
        },
        {
            id: "HR",
            name: "Harbour Line",
            color: "#388e3c",
            frequency: "8-15 min",
            hours: "4:30 AM - 12:30 AM",
            stations: [
                { name: "CSMT",               lat: 18.9400, lng: 72.8356 },
                { name: "Masjid Bunder",      lat: 18.9493, lng: 72.8397 },
                { name: "Sandhurst Road",     lat: 18.9580, lng: 72.8390 },
                { name: "Dockyard Road",      lat: 18.9610, lng: 72.8470 },
                { name: "Reay Road",          lat: 18.9680, lng: 72.8470 },
                { name: "Cotton Green",       lat: 18.9800, lng: 72.8490 },
                { name: "Sewri",              lat: 18.9920, lng: 72.8530 },
                { name: "Vadala Road",        lat: 19.0080, lng: 72.8570 },
                { name: "King's Circle",      lat: 19.0250, lng: 72.8580 },
                { name: "Mahim Junction",     lat: 19.0395, lng: 72.8402 },
                { name: "Bandra",             lat: 19.0544, lng: 72.8402 },
                { name: "Khar Road",          lat: 19.0650, lng: 72.8365 },
                { name: "Santacruz",          lat: 19.0800, lng: 72.8386 },
                { name: "Vile Parle",         lat: 19.0970, lng: 72.8438 },
                { name: "Andheri",            lat: 19.1197, lng: 72.8464 },
            ],
        },
    ],
};

// ── Helper functions ────────────────────────────────────────────────────


/** Find nearest station on a given line to a lat/lng */
function findNearest(stations, lat, lng) {
    let best = null;
    let bestDist = Infinity;
    stations.forEach((s, idx) => {
        const d = haversineKm(lat, lng, s.lat, s.lng);
        if (d < bestDist) {
            bestDist = d;
            best = { ...s, index: idx, walkKm: d };
        }
    });
    return best;
}

/** Mumbai local train fare estimation (2nd class) */
function estimateFare(distanceKm) {
    if (distanceKm <= 10) return 5;
    if (distanceKm <= 25) return 10;
    if (distanceKm <= 50) return 15;
    if (distanceKm <= 75) return 20;
    return 30;
}

/** Average local train speed including stops (~33 km/h including dwell time) */
const TRAIN_SPEED_KMPH = 33;

/** Max walk to station radius (km) */
const MAX_WALK_KM = 3.0;

/** Format duration from seconds */
function formatDuration(seconds) {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return mins + " min";
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? hrs + "h " + rem + "m" : hrs + "h";
}

// ── Main evaluation ────────────────────────────────────────────────────

/**
 * Evaluate if a Mumbai local train route is viable between two points.
 * Returns a mode object compatible with routeService or null.
 */
export function evaluateTrain(startLat, startLng, endLat, endLng) {
    // Check if both points are within Mumbai bounds
    const b = MUMBAI_LOCAL.bounds;
    const inBounds =
        startLat >= b.latMin && startLat <= b.latMax &&
        startLng >= b.lngMin && startLng <= b.lngMax &&
        endLat >= b.latMin && endLat <= b.latMax &&
        endLng >= b.lngMin && endLng <= b.lngMax;

    if (!inBounds) return null;

    let bestResult = null;
    let bestScore = Infinity;

    for (const line of MUMBAI_LOCAL.lines) {
        const boarding = findNearest(line.stations, startLat, startLng);
        const alighting = findNearest(line.stations, endLat, endLng);

        if (!boarding || !alighting) continue;
        if (boarding.walkKm > MAX_WALK_KM || alighting.walkKm > MAX_WALK_KM) continue;
        if (boarding.name === alighting.name) continue;

        // Station count (inclusive)
        const stationCount = Math.abs(alighting.index - boarding.index);
        if (stationCount < 1) continue;

        // Distance along the line (approximate: station-to-station haversine sum)
        let lineDistKm = 0;
        const startIdx = Math.min(boarding.index, alighting.index);
        const endIdx = Math.max(boarding.index, alighting.index);
        for (let i = startIdx; i < endIdx; i++) {
            lineDistKm += haversineKm(
                line.stations[i].lat, line.stations[i].lng,
                line.stations[i + 1].lat, line.stations[i + 1].lng
            );
        }

        // Multiply by 1.15 for track curve factor
        lineDistKm *= 1.15;

        // Travel time: train time + walk time (5 km/h) + 5 min average wait
        const trainTimeSec = (lineDistKm / TRAIN_SPEED_KMPH) * 3600;
        const walkTimeSec = ((boarding.walkKm + alighting.walkKm) / 5) * 3600;
        const waitTimeSec = 5 * 60; // average wait
        const totalSec = trainTimeSec + walkTimeSec + waitTimeSec;

        const fare = estimateFare(lineDistKm);
        const totalDistKm = lineDistKm + boarding.walkKm + alighting.walkKm;

        // Score: lower is better (cost + time in minutes)
        const score = fare + totalSec / 60;

        if (score < bestScore) {
            bestScore = score;

            // Peak hour detection
            const hour = new Date().getHours();
            const isPeak = (hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 21);
            const crowdLevel = isPeak ? "packed" : stationCount > 10 ? "moderate" : "low";

            bestResult = {
                mode: "train",
                label: line.name,
                distance: totalDistKm.toFixed(1) + " km",
                duration: formatDuration(totalSec),
                durationSec: totalSec,
                cost: "\u20B9" + fare,
                costAmount: fare,
                frequency: line.frequency,
                crowdLevel: crowdLevel,
                peakWarning: isPeak ? "Peak hours — expect heavy crowding" : null,
                boarding: boarding.name,
                alighting: alighting.name,
                destination: alighting.name,
                stationCount: stationCount,
                lineColor: line.color,
                lineName: line.name,
                walkToStation: boarding.walkKm.toFixed(1) + " km",
                walkFromStation: alighting.walkKm.toFixed(1) + " km",
                geometry: [],
                isBest: false,
            };
        }
    }

    return bestResult;
}
