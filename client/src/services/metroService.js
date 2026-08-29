/**
 * Metro intelligence service — real station data, nearest-station lookup,
 * ETA calculation, and fare estimation for Indian metro systems.
 *
 * Currently covers: Mumbai (Lines 1, 2A, 7, 7A, 3).
 * Extendable to Delhi, Bangalore, Chennai, Kolkata, Hyderabad.
 */

import { haversineKm } from "../utils/geo";

// ── Mumbai Metro Dataset ────────────────────────────────────────────────────

const MUMBAI_METRO = {
    city: "Mumbai",
    bounds: { latMin: 18.87, latMax: 19.32, lngMin: 72.75, lngMax: 73.05 },
    lines: [
        {
            id: "L1",
            name: "Line 1 (Blue)",
            color: "#0057a7",
            frequency: "4-7 min",
            hours: "6:00 AM - 10:30 PM",
            stations: [
                { name: "Versova",          lat: 19.1312, lng: 72.8171 },
                { name: "D N Nagar",        lat: 19.1268, lng: 72.8276 },
                { name: "Azad Nagar",       lat: 19.1190, lng: 72.8365 },
                { name: "Andheri",          lat: 19.1197, lng: 72.8464 },
                { name: "Western Express Highway", lat: 19.1176, lng: 72.8570 },
                { name: "Chakala",          lat: 19.1136, lng: 72.8618 },
                { name: "Airport Road",     lat: 19.1103, lng: 72.8710 },
                { name: "Marol Naka",       lat: 19.1027, lng: 72.8794 },
                { name: "Saki Naka",        lat: 19.0918, lng: 72.8878 },
                { name: "Asalpha",          lat: 19.0870, lng: 72.8895 },
                { name: "Jagruti Nagar",    lat: 19.0822, lng: 72.8892 },
                { name: "Ghatkopar",        lat: 19.0866, lng: 72.9085 },
            ],
        },
        {
            id: "L2A",
            name: "Line 2A (Yellow)",
            color: "#ffd700",
            frequency: "5-8 min",
            hours: "6:30 AM - 10:00 PM",
            stations: [
                { name: "Dahisar East",     lat: 19.2568, lng: 72.8638 },
                { name: "Anand Nagar",      lat: 19.2410, lng: 72.8620 },
                { name: "Ovaripada",        lat: 19.2330, lng: 72.8596 },
                { name: "Shimpoli",         lat: 19.2205, lng: 72.8538 },
                { name: "Eksar",            lat: 19.2110, lng: 72.8460 },
                { name: "Borivali West",    lat: 19.2290, lng: 72.8568 },
                { name: "Mandapeshwar",     lat: 19.2000, lng: 72.8425 },
                { name: "Dahanukarwadi",    lat: 19.1937, lng: 72.8396 },
                { name: "Kandivali West",   lat: 19.2060, lng: 72.8448 },
                { name: "Charkop",          lat: 19.2075, lng: 72.8290 },
                { name: "Malad West",       lat: 19.1865, lng: 72.8378 },
                { name: "Lower Malad",      lat: 19.1810, lng: 72.8355 },
                { name: "Goregaon West",    lat: 19.1655, lng: 72.8380 },
                { name: "Oshiwara",         lat: 19.1530, lng: 72.8365 },
                { name: "Lokhandwala",      lat: 19.1420, lng: 72.8280 },
                { name: "Jogeshwari West",  lat: 19.1365, lng: 72.8320 },
                { name: "D N Nagar",        lat: 19.1268, lng: 72.8276 },
            ],
        },
        {
            id: "L7",
            name: "Line 7 (Red)",
            color: "#e53935",
            frequency: "5-8 min",
            hours: "6:30 AM - 10:00 PM",
            stations: [
                { name: "Dahisar East",     lat: 19.2568, lng: 72.8680 },
                { name: "Ovaripada",        lat: 19.2330, lng: 72.8680 },
                { name: "Rashtriya Udyan",  lat: 19.2265, lng: 72.8645 },
                { name: "Poisar",           lat: 19.2179, lng: 72.8630 },
                { name: "Magathane",        lat: 19.2070, lng: 72.8600 },
                { name: "Devipada",         lat: 19.1970, lng: 72.8575 },
                { name: "Kurar",            lat: 19.1890, lng: 72.8605 },
                { name: "Dindoshi",         lat: 19.1780, lng: 72.8620 },
                { name: "Pathanwadi",       lat: 19.1690, lng: 72.8610 },
                { name: "Goregaon East",    lat: 19.1620, lng: 72.8620 },
                { name: "Aarey JVLR",       lat: 19.1510, lng: 72.8690 },
                { name: "Mogra",            lat: 19.1330, lng: 72.8670 },
                { name: "Andheri East",     lat: 19.1197, lng: 72.8620 },
            ],
        },
        {
            id: "L3",
            name: "Line 3 (Aqua)",
            color: "#00bcd4",
            frequency: "4-6 min",
            hours: "6:00 AM - 11:00 PM",
            stations: [
                { name: "Aarey Colony",     lat: 19.1565, lng: 72.8750 },
                { name: "SEEPZ",            lat: 19.1290, lng: 72.8775 },
                { name: "MIDC",             lat: 19.1233, lng: 72.8730 },
                { name: "Marol Naka",       lat: 19.1027, lng: 72.8794 },
                { name: "CSIA Domestic",    lat: 19.0960, lng: 72.8681 },
                { name: "CSIA International", lat: 19.0887, lng: 72.8638 },
                { name: "Sahar Road",       lat: 19.0850, lng: 72.8555 },
                { name: "BKC",              lat: 19.0640, lng: 72.8660 },
                { name: "Vidyanagari",      lat: 19.0740, lng: 72.8570 },
                { name: "Dharavi",          lat: 19.0440, lng: 72.8530 },
                { name: "Dadar",            lat: 19.0176, lng: 72.8428 },
                { name: "Worli",            lat: 19.0098, lng: 72.8165 },
                { name: "Siddhivinayak",    lat: 19.0168, lng: 72.8303 },
                { name: "Science Museum",   lat: 18.9962, lng: 72.8203 },
                { name: "Acharya Atre Chowk", lat: 18.9840, lng: 72.8162 },
                { name: "Girgaon",          lat: 18.9585, lng: 72.8147 },
                { name: "Grant Road",       lat: 18.9630, lng: 72.8190 },
                { name: "Mumbai Central",   lat: 18.9692, lng: 72.8195 },
                { name: "Mahalaxmi",        lat: 18.9830, lng: 72.8178 },
                { name: "CST",              lat: 18.9400, lng: 72.8355 },
                { name: "Cuffe Parade",     lat: 18.9163, lng: 72.8217 },
            ],
        },
    ],
    /** Interchange stations — same name on multiple lines */
    interchanges: {
        "D N Nagar":   ["L1", "L2A"],
        "Marol Naka":  ["L1", "L3"],
        "Dahisar East":["L2A", "L7"],
        "Andheri East":["L7", "L1"],
    },
};

// ── All city datasets ────────────────────────────────────────────────────────

const METRO_CITIES = [MUMBAI_METRO];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the nearest metro station to given coordinates across all lines.
 * Returns { station, line, distKm } or null if too far (> maxWalkKm).
 */
function findNearestStation(lat, lng, city, maxWalkKm = 3) {
    let best = null;
    for (const line of city.lines) {
        for (const st of line.stations) {
            const d = haversineKm(lat, lng, st.lat, st.lng);
            if (d <= maxWalkKm && (!best || d < best.distKm)) {
                best = { station: st, line, distKm: d };
            }
        }
    }
    return best;
}

/**
 * Count how many stations apart two stations are on the same line.
 */
function stationCountOnLine(line, fromName, toName) {
    const fromIdx = line.stations.findIndex((s) => s.name === fromName);
    const toIdx = line.stations.findIndex((s) => s.name === toName);
    if (fromIdx === -1 || toIdx === -1) return null;
    return Math.abs(toIdx - fromIdx);
}

/**
 * Try to find a path between two stations, possibly with one interchange.
 * Returns { boarding, alighting, lineName, interchange, stationCount } or null.
 */
function findMetroPath(city, boardingStation, boardingLine, alightingStation, alightingLine) {
    // Case 1: same line
    if (boardingLine.id === alightingLine.id) {
        const count = stationCountOnLine(boardingLine, boardingStation.name, alightingStation.name);
        return {
            boarding: boardingStation.name,
            alighting: alightingStation.name,
            line: boardingLine.name,
            lineColor: boardingLine.color,
            interchange: null,
            stationCount: count || 0,
        };
    }

    // Case 2: different lines — find interchange
    for (const [stName, lineIds] of Object.entries(city.interchanges)) {
        if (lineIds.includes(boardingLine.id) && lineIds.includes(alightingLine.id)) {
            const seg1 = stationCountOnLine(boardingLine, boardingStation.name, stName);
            const seg2 = stationCountOnLine(alightingLine, stName, alightingStation.name);
            if (seg1 !== null && seg2 !== null) {
                return {
                    boarding: boardingStation.name,
                    alighting: alightingStation.name,
                    line: boardingLine.name + " \u2192 " + alightingLine.name,
                    lineColor: boardingLine.color,
                    interchange: stName,
                    stationCount: seg1 + seg2,
                };
            }
        }
    }

    // Case 3: no direct interchange — try two-hop (lineA -> interchangeX -> lineB)
    for (const [st1, ids1] of Object.entries(city.interchanges)) {
        if (!ids1.includes(boardingLine.id)) continue;
        for (const midLineId of ids1) {
            if (midLineId === boardingLine.id) continue;
            for (const [st2, ids2] of Object.entries(city.interchanges)) {
                if (st1 === st2) continue;
                if (ids2.includes(midLineId) && ids2.includes(alightingLine.id)) {
                    const midLine = city.lines.find((l) => l.id === midLineId);
                    if (!midLine) continue;
                    const seg1 = stationCountOnLine(boardingLine, boardingStation.name, st1);
                    const seg2 = stationCountOnLine(midLine, st1, st2);
                    const seg3 = stationCountOnLine(alightingLine, st2, alightingStation.name);
                    if (seg1 !== null && seg2 !== null && seg3 !== null) {
                        return {
                            boarding: boardingStation.name,
                            alighting: alightingStation.name,
                            line: boardingLine.name + " \u2192 " + midLine.name + " \u2192 " + alightingLine.name,
                            lineColor: boardingLine.color,
                            interchange: st1 + ", " + st2,
                            stationCount: seg1 + seg2 + seg3,
                        };
                    }
                }
            }
        }
    }

    return null;
}

// ── Fare & ETA Logic ─────────────────────────────────────────────────────────

/**
 * Indian metro fare slab (based on Mumbai Metro fare structure).
 * Stations   | Fare
 * 0-3        | ₹10
 * 4-6        | ₹20
 * 7-10       | ₹30
 * 11-15      | ₹40
 * 16+        | ₹50-60
 */
function calculateFare(stationCount) {
    if (stationCount <= 3)  return 10;
    if (stationCount <= 6)  return 20;
    if (stationCount <= 10) return 30;
    if (stationCount <= 15) return 40;
    return 50;
}

/**
 * Estimate metro travel time:
 *  - ~2 min per station (average: 35 km/h metro speed with 1-min dwell)
 *  - +4 min per interchange (walk + wait)
 *  - +walkTime to/from station (~12 min/km walking)
 */
function calculateDuration(stationCount, interchangeCount, walkToStationKm, walkFromStationKm) {
    const rideMinutes = stationCount * 2;
    const interchangeMinutes = interchangeCount * 4;
    const walkMinutes = (walkToStationKm + walkFromStationKm) * 12;
    return Math.round(rideMinutes + interchangeMinutes + walkMinutes);
}

/** Format minutes to human string */
function formatMinutes(min) {
    if (min < 60) return min + " min";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? h + "h " + m + "m" : h + "h";
}

/**
 * Detect if a coordinate is within any metro city's bounding box.
 */
function detectMetroCity(lat, lng) {
    for (const city of METRO_CITIES) {
        const b = city.bounds;
        if (lat >= b.latMin && lat <= b.latMax && lng >= b.lngMin && lng <= b.lngMax) {
            return city;
        }
    }
    return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate metro as a transport option between two points.
 *
 * Returns a route mode object compatible with routeService's buildModes() format,
 * or null if metro is not available/applicable for this trip.
 *
 * @param {number} startLat
 * @param {number} startLng
 * @param {number} endLat
 * @param {number} endLng
 * @returns {{ mode, label, distance, duration, durationSec, cost, costAmount,
 *             boarding, alighting, lineName, lineColor, interchange, frequency,
 *             stationCount, walkToStation, walkFromStation, geometry } | null}
 */
export function evaluateMetro(startLat, startLng, endLat, endLng) {
    // 1. Check if origin is in a metro city
    const city = detectMetroCity(startLat, startLng);
    if (!city) return null;

    // Also verify destination is in the same metro city
    const destCity = detectMetroCity(endLat, endLng);
    if (!destCity || destCity.city !== city.city) return null;

    // 2. Find nearest station to origin
    const originNearest = findNearestStation(startLat, startLng, city);
    if (!originNearest) return null;

    // 3. Find nearest station to destination
    const destNearest = findNearestStation(endLat, endLng, city);
    if (!destNearest) return null;

    // 4. Don't suggest metro if both points are near the same station
    if (originNearest.station.name === destNearest.station.name) return null;

    // 5. Find path (same line or with interchange)
    const path = findMetroPath(
        city,
        originNearest.station, originNearest.line,
        destNearest.station, destNearest.line
    );
    if (!path) return null;

    // 6. Must cross at least 2 stations to be worthwhile
    if (path.stationCount < 2) return null;

    // 7. Calculate fare
    const fare = calculateFare(path.stationCount);

    // 8. Calculate ETA
    const interchangeCount = path.interchange
        ? path.interchange.split(",").length
        : 0;
    const totalMinutes = calculateDuration(
        path.stationCount,
        interchangeCount,
        originNearest.distKm,
        destNearest.distKm
    );
    const durationSec = totalMinutes * 60;

    // 9. Total distance: walk to station + metro ride + walk from station
    const metroRideKm = path.stationCount * 1.2; // avg ~1.2 km between stations
    const totalKm = originNearest.distKm + metroRideKm + destNearest.distKm;

    // 10. Determine metro line frequency
    const frequency = originNearest.line.frequency || "4-8 min";

    // 11. Build label
    let label = "Metro " + path.line;

    // 12. Determine peak warning
    const hour = new Date().getHours();
    let peakWarning = null;
    if ((hour >= 8 && hour <= 11) || (hour >= 18 && hour <= 21)) {
        peakWarning = "Peak hours — expect high crowd at boarding";
    }

    return {
        mode: "metro",
        label: label,
        distance: totalKm.toFixed(1) + " km",
        duration: formatMinutes(totalMinutes),
        durationSec: durationSec,
        cost: "\u20B9" + fare,
        costAmount: fare,
        boarding: path.boarding,
        alighting: path.alighting,
        lineName: path.line,
        lineColor: path.lineColor,
        interchange: path.interchange,
        frequency: frequency,
        stationCount: path.stationCount,
        walkToStation: originNearest.distKm.toFixed(1) + " km",
        walkFromStation: destNearest.distKm.toFixed(1) + " km",
        peakWarning: peakWarning,
        geometry: [], // metro doesn't have road geometry
        isBest: false, // will be set by routeService's best-option algorithm
    };
}

/**
 * Check if metro is available (any city coverage) near a given point.
 */
export function isMetroAvailable(lat, lng) {
    return detectMetroCity(lat, lng) !== null;
}
