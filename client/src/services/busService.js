/**
 * Bus intelligence service — real bus stop data, nearest-stop lookup,
 * and fare/ETA estimation for Indian city bus networks.
 *
 * Currently covers: Mumbai (BEST — Brihanmumbai Electric Supply & Transport).
 * Extendable to other cities.
 */

import { haversineKm } from "../utils/geo";

// ── Mumbai BEST Bus Stops Dataset ────────────────────────────────────────────
// Major stops across Mumbai with real coordinates.
// Organized by area clusters for efficient lookup.

const MUMBAI_BUS_STOPS = [
    // ── South Mumbai ──
    { name: "CSMT Bus Station",       lat: 18.9398, lng: 72.8354, area: "fort" },
    { name: "Flora Fountain",         lat: 18.9337, lng: 72.8310, area: "fort" },
    { name: "Churchgate Station",     lat: 18.9352, lng: 72.8272, area: "churchgate" },
    { name: "Marine Lines Station",   lat: 18.9438, lng: 72.8234, area: "marine_lines" },
    { name: "Chowpatty",             lat: 18.9543, lng: 72.8140, area: "chowpatty" },
    { name: "Colaba Bus Station",    lat: 18.9067, lng: 72.8147, area: "colaba" },
    { name: "Nariman Point",         lat: 18.9255, lng: 72.8242, area: "nariman_point" },
    { name: "Mantralaya",            lat: 18.9264, lng: 72.8213, area: "nariman_point" },
    { name: "Cuffe Parade Depot",    lat: 18.9167, lng: 72.8205, area: "cuffe_parade" },
    { name: "Regal Cinema",          lat: 18.9273, lng: 72.8316, area: "colaba" },
    { name: "Gateway of India",      lat: 18.9220, lng: 72.8347, area: "colaba" },

    // ── Central Mumbai ──
    { name: "Dadar TT",              lat: 19.0176, lng: 72.8428, area: "dadar" },
    { name: "Dadar Station East",    lat: 19.0183, lng: 72.8453, area: "dadar" },
    { name: "Siddhivinayak Temple",  lat: 19.0168, lng: 72.8303, area: "prabhadevi" },
    { name: "Worli Naka",            lat: 19.0048, lng: 72.8178, area: "worli" },
    { name: "Worli Sea Face",        lat: 19.0005, lng: 72.8140, area: "worli" },
    { name: "Haji Ali",              lat: 18.9828, lng: 72.8120, area: "haji_ali" },
    { name: "Mahalaxmi Station",     lat: 18.9830, lng: 72.8178, area: "mahalaxmi" },
    { name: "Mumbai Central Depot",  lat: 18.9700, lng: 72.8190, area: "mumbai_central" },
    { name: "Grant Road Station",    lat: 18.9630, lng: 72.8190, area: "grant_road" },
    { name: "Byculla Station",       lat: 18.9780, lng: 72.8340, area: "byculla" },
    { name: "Lalbaug",               lat: 18.9930, lng: 72.8370, area: "lalbaug" },
    { name: "Parel Station",         lat: 19.0060, lng: 72.8420, area: "parel" },
    { name: "Sion Station",          lat: 19.0444, lng: 72.8623, area: "sion" },
    { name: "Dharavi Bus Stop",      lat: 19.0440, lng: 72.8530, area: "dharavi" },
    { name: "Mahim Bus Depot",       lat: 19.0350, lng: 72.8400, area: "mahim" },
    { name: "King Circle",           lat: 19.0320, lng: 72.8570, area: "matunga" },

    // ── Western Suburbs ──
    { name: "Bandra Station West",   lat: 19.0544, lng: 72.8402, area: "bandra" },
    { name: "Bandra Bus Station",    lat: 19.0553, lng: 72.8367, area: "bandra" },
    { name: "BKC Bus Stop",          lat: 19.0640, lng: 72.8660, area: "bkc" },
    { name: "Khar Station West",     lat: 19.0712, lng: 72.8372, area: "khar" },
    { name: "Santacruz Station West",lat: 19.0830, lng: 72.8380, area: "santacruz" },
    { name: "Vile Parle Station West", lat: 19.0980, lng: 72.8440, area: "vile_parle" },
    { name: "Vile Parle Station East", lat: 19.0968, lng: 72.8490, area: "vile_parle" },
    { name: "Andheri Station West",  lat: 19.1197, lng: 72.8464, area: "andheri" },
    { name: "Andheri Station East",  lat: 19.1190, lng: 72.8530, area: "andheri" },
    { name: "DN Nagar Bus Stop",     lat: 19.1268, lng: 72.8276, area: "andheri" },
    { name: "Lokhandwala Circle",    lat: 19.1370, lng: 72.8280, area: "andheri" },
    { name: "Oshiwara Bus Depot",    lat: 19.1530, lng: 72.8365, area: "oshiwara" },
    { name: "Jogeshwari Station West", lat: 19.1365, lng: 72.8320, area: "jogeshwari" },
    { name: "Goregaon Station West", lat: 19.1655, lng: 72.8480, area: "goregaon" },
    { name: "Goregaon Bus Depot",    lat: 19.1620, lng: 72.8530, area: "goregaon" },
    { name: "Malad Station West",    lat: 19.1865, lng: 72.8450, area: "malad" },
    { name: "Malad Station East",    lat: 19.1860, lng: 72.8510, area: "malad" },
    { name: "Kandivali Station West",lat: 19.2060, lng: 72.8480, area: "kandivali" },
    { name: "Kandivali Station East",lat: 19.2050, lng: 72.8570, area: "kandivali" },
    { name: "Borivali Station West", lat: 19.2290, lng: 72.8568, area: "borivali" },
    { name: "Borivali Bus Depot",    lat: 19.2305, lng: 72.8530, area: "borivali" },
    { name: "Dahisar Bus Stand",     lat: 19.2568, lng: 72.8638, area: "dahisar" },

    // ── Eastern Suburbs ──
    { name: "Kurla Station West",    lat: 19.0728, lng: 72.8788, area: "kurla" },
    { name: "Kurla Bus Depot",       lat: 19.0700, lng: 72.8820, area: "kurla" },
    { name: "Ghatkopar Station West",lat: 19.0866, lng: 72.9085, area: "ghatkopar" },
    { name: "Ghatkopar Bus Depot",   lat: 19.0845, lng: 72.9100, area: "ghatkopar" },
    { name: "Vikhroli Station",      lat: 19.1060, lng: 72.9262, area: "vikhroli" },
    { name: "Powai Lake",            lat: 19.1249, lng: 72.9058, area: "powai" },
    { name: "Hiranandani Powai",     lat: 19.1190, lng: 72.9090, area: "powai" },
    { name: "Mulund Station West",   lat: 19.1727, lng: 72.9565, area: "mulund" },
    { name: "Mulund Check Naka",     lat: 19.1760, lng: 72.9430, area: "mulund" },
    { name: "Thane Station",         lat: 19.1860, lng: 72.9752, area: "thane" },
    { name: "Bhandup Station",       lat: 19.1506, lng: 72.9374, area: "bhandup" },

    // ── Harbor / Navi Mumbai ──
    { name: "Chembur Bus Depot",     lat: 19.0621, lng: 72.8973, area: "chembur" },
    { name: "Mankhurd Station",      lat: 19.0510, lng: 72.9310, area: "mankhurd" },
    { name: "Vashi Bus Station",     lat: 19.0763, lng: 72.9988, area: "vashi" },
    { name: "Nerul Station",         lat: 19.0330, lng: 73.0162, area: "nerul" },
    { name: "Belapur CBD Station",   lat: 19.0230, lng: 73.0370, area: "belapur" },
    { name: "Panvel Bus Station",    lat: 18.9935, lng: 73.1190, area: "panvel" },

    // ── Airport / MIDC ──
    { name: "Airport Gate No 1",     lat: 19.0990, lng: 72.8640, area: "airport" },
    { name: "MIDC Bus Stop",         lat: 19.1233, lng: 72.8730, area: "midc" },
    { name: "SEEPZ Gate",            lat: 19.1290, lng: 72.8775, area: "seepz" },
    { name: "Marol Maroshi Road",    lat: 19.1100, lng: 72.8790, area: "marol" },
    { name: "Saki Naka Junction",    lat: 19.0918, lng: 72.8878, area: "saki_naka" },
    { name: "Chakala Junction",      lat: 19.1136, lng: 72.8618, area: "chakala" },
];

// Mumbai geographic bounds
const MUMBAI_BOUNDS = { latMin: 18.87, latMax: 19.32, lngMin: 72.75, lngMax: 73.15 };

// ── Common Mumbai BEST Bus Routes ────────────────────────────────────────────
// Mapping of area-pair patterns to real bus route numbers.

const MUMBAI_BUS_ROUTES = [
    { routes: "1 / 3",       from: "colaba",     to: "byculla" },
    { routes: "1Ltd",        from: "colaba",     to: "dadar" },
    { routes: "3Ltd",        from: "colaba",     to: "worli" },
    { routes: "6",           from: "fort",       to: "haji_ali" },
    { routes: "22Ltd",       from: "fort",       to: "sion" },
    { routes: "25Ltd",       from: "fort",       to: "parel" },
    { routes: "63",          from: "dadar",      to: "goregaon" },
    { routes: "65 / 66",     from: "dadar",      to: "andheri" },
    { routes: "70 / 72",     from: "dadar",      to: "bandra" },
    { routes: "79 / 79Ltd",  from: "dharavi",    to: "kurla" },
    { routes: "83",          from: "bandra",     to: "andheri" },
    { routes: "203",         from: "bandra",     to: "kurla" },
    { routes: "212 / 214",   from: "kurla",      to: "ghatkopar" },
    { routes: "248 / 250",   from: "andheri",    to: "borivali" },
    { routes: "252 / 256",   from: "andheri",    to: "goregaon" },
    { routes: "260",         from: "andheri",    to: "malad" },
    { routes: "271",         from: "andheri",    to: "oshiwara" },
    { routes: "332",         from: "malad",      to: "kandivali" },
    { routes: "340 / 342",   from: "kandivali",  to: "borivali" },
    { routes: "355 / 356",   from: "borivali",   to: "dahisar" },
    { routes: "460 / 462",   from: "ghatkopar",  to: "mulund" },
    { routes: "500 / 501",   from: "kurla",      to: "chembur" },
    { routes: "506",         from: "sion",       to: "chembur" },
    { routes: "C-49",        from: "bkc",        to: "kurla" },
    { routes: "A-31",        from: "bandra",     to: "bkc" },
    { routes: "AC-24",       from: "vile_parle", to: "bkc" },
    { routes: "305",         from: "goregaon",   to: "malad" },
    { routes: "386",         from: "malad",      to: "goregaon" },
    { routes: "401",         from: "bhandup",    to: "mulund" },
    { routes: "485",         from: "ghatkopar",  to: "powai" },
    { routes: "495",         from: "vikhroli",   to: "powai" },
    { routes: "525",         from: "chembur",    to: "vashi" },
    { routes: "21",          from: "fort",       to: "chowpatty" },
    { routes: "99",          from: "churchgate", to: "bandra" },
    { routes: "103",         from: "churchgate", to: "bandra" },
    { routes: "84 / 84Ltd",  from: "santacruz",  to: "andheri" },
    { routes: "132",         from: "matunga",    to: "dadar" },
    { routes: "174",         from: "sion",       to: "kurla" },
    { routes: "368",         from: "jogeshwari", to: "goregaon" },
    { routes: "AC-101",      from: "fort",       to: "andheri" },
    { routes: "AC-131",      from: "churchgate", to: "andheri" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the N nearest bus stops to given coordinates.
 * Returns sorted array of { stop, distKm }.
 */
function findNearestStops(lat, lng, maxCount, maxWalkKm) {
    maxCount = maxCount || 3;
    maxWalkKm = maxWalkKm || 2.5;

    var candidates = [];
    for (var i = 0; i < MUMBAI_BUS_STOPS.length; i++) {
        var st = MUMBAI_BUS_STOPS[i];
        var d = haversineKm(lat, lng, st.lat, st.lng);
        if (d <= maxWalkKm) {
            candidates.push({ stop: st, distKm: d });
        }
    }

    // Sort by distance ascending
    candidates.sort(function(a, b) { return a.distKm - b.distKm; });
    return candidates.slice(0, maxCount);
}

/**
 * Try to match a known Mumbai BEST bus route between two area clusters.
 * Returns a route string like "65 / 66" or a generated one.
 */
function matchBusRoute(boardingArea, alightingArea) {
    // Direct match
    for (var i = 0; i < MUMBAI_BUS_ROUTES.length; i++) {
        var r = MUMBAI_BUS_ROUTES[i];
        if (
            (r.from === boardingArea && r.to === alightingArea) ||
            (r.from === alightingArea && r.to === boardingArea)
        ) {
            return r.routes;
        }
    }
    return null;
}

/**
 * Generate a plausible bus route number when no exact match is found.
 * Uses a hash of the area names for deterministic output.
 */
function generateRouteNumber(boardingArea, alightingArea) {
    var hash = 0;
    var combined = boardingArea + alightingArea;
    for (var i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit int
    }
    var num = Math.abs(hash % 800) + 100;
    return "Bus " + num;
}

// ── Fare & ETA Logic ─────────────────────────────────────────────────────────

/**
 * BEST bus fare slab (approximate current rates):
 * First 5 km: ₹6
 * 5-10 km:    ₹10-15
 * 10-20 km:   ₹15-25
 * 20+ km:     ₹25-40
 * AC buses:   ~2x regular
 */
function calculateBusFare(distanceKm) {
    if (distanceKm <= 5)  return 6;
    if (distanceKm <= 10) return Math.round(6 + (distanceKm - 5) * 2);
    if (distanceKm <= 20) return Math.round(16 + (distanceKm - 10) * 1);
    return Math.round(26 + (distanceKm - 20) * 0.8);
}

/**
 * Estimate bus travel time:
 * - Average bus speed in Mumbai: 12-18 km/h (with stops, traffic)
 * - Add walk time to/from stop (~12 min/km)
 * - Add ~5 min average waiting time
 */
function calculateBusDuration(distanceKm, walkToKm, walkFromKm) {
    var avgSpeedKmph = 14; // Mumbai BEST average with stops
    var rideMinutes = Math.round((distanceKm / avgSpeedKmph) * 60);
    var walkMinutes = Math.round((walkToKm + walkFromKm) * 12);
    var waitMinutes = 5; // average wait
    return rideMinutes + walkMinutes + waitMinutes;
}

/** Format minutes to human string */
function formatMinutes(min) {
    if (min < 60) return min + " min";
    var h = Math.floor(min / 60);
    var m = min % 60;
    return m > 0 ? h + "h " + m + "m" : h + "h";
}

/**
 * Estimate bus frequency based on time of day.
 */
function estimateFrequency() {
    var hour = new Date().getHours();
    if (hour >= 7 && hour <= 11) return "Every 8-12 min";
    if (hour >= 17 && hour <= 21) return "Every 8-12 min";
    if (hour >= 11 && hour <= 17) return "Every 12-18 min";
    return "Every 15-25 min";
}

/**
 * Estimate crowd level based on time of day.
 */
function estimateCrowd() {
    var hour = new Date().getHours();
    if (hour >= 8 && hour <= 10) return "high";
    if (hour >= 18 && hour <= 20) return "high";
    if (hour >= 7 && hour <= 11) return "moderate";
    if (hour >= 17 && hour <= 21) return "moderate";
    return "low";
}

/**
 * Check if coordinates are within Mumbai.
 */
function isInMumbai(lat, lng) {
    return (
        lat >= MUMBAI_BOUNDS.latMin && lat <= MUMBAI_BOUNDS.latMax &&
        lng >= MUMBAI_BOUNDS.lngMin && lng <= MUMBAI_BOUNDS.lngMax
    );
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate bus as a transport option between two points.
 *
 * Returns a route mode object compatible with routeService's buildModes() format,
 * or null if bus data is not available for this trip.
 *
 * GUARANTEES: boarding and alighting stops are NEVER the same.
 *
 * @param {number} startLat
 * @param {number} startLng
 * @param {number} endLat
 * @param {number} endLng
 * @param {number} roadDistanceKm - road distance from routeService (if available)
 * @returns {object|null}
 */
export function evaluateBus(startLat, startLng, endLat, endLng, roadDistanceKm) {
    // 1. Check if origin and destination are in Mumbai
    if (!isInMumbai(startLat, startLng) || !isInMumbai(endLat, endLng)) {
        return null;
    }

    // 2. Find nearest stops to origin (top 3)
    var originStops = findNearestStops(startLat, startLng, 3, 2.5);
    if (originStops.length === 0) return null;

    // 3. Find nearest stops to destination (top 3)
    var destStops = findNearestStops(endLat, endLng, 3, 2.5);
    if (destStops.length === 0) return null;

    // 4. Select boarding and alighting — MUST be different stops
    var boarding = originStops[0];
    var alighting = null;

    // Try each destination candidate until we find one different from boarding
    for (var i = 0; i < destStops.length; i++) {
        if (destStops[i].stop.name !== boarding.stop.name) {
            alighting = destStops[i];
            break;
        }
    }

    // If all destination stops matched boarding, try second-nearest origin stop
    if (!alighting && originStops.length > 1) {
        boarding = originStops[1];
        for (var j = 0; j < destStops.length; j++) {
            if (destStops[j].stop.name !== boarding.stop.name) {
                alighting = destStops[j];
                break;
            }
        }
    }

    // Still no valid pair — can't suggest bus
    if (!alighting) return null;

    // 5. Calculate route distance (bus travel between stops)
    var busDistanceKm = roadDistanceKm ||
        haversineKm(boarding.stop.lat, boarding.stop.lng, alighting.stop.lat, alighting.stop.lng) * 1.4; // road factor

    // Minimum meaningful bus distance
    if (busDistanceKm < 0.5) return null;

    // 6. Match or generate bus route number
    var routeNumber = matchBusRoute(boarding.stop.area, alighting.stop.area);
    if (!routeNumber) {
        routeNumber = generateRouteNumber(boarding.stop.area, alighting.stop.area);
    }

    // 7. Calculate fare and duration
    var fare = calculateBusFare(busDistanceKm);
    var totalMinutes = calculateBusDuration(busDistanceKm, boarding.distKm, alighting.distKm);
    var durationSec = totalMinutes * 60;

    // 8. Frequency and crowd level
    var frequency = estimateFrequency();
    var crowdLevel = estimateCrowd();

    // 9. Peak warning
    var hour = new Date().getHours();
    var peakWarning = null;
    if ((hour >= 8 && hour <= 11) || (hour >= 18 && hour <= 21)) {
        peakWarning = "Peak hours \u2014 expect crowded buses and traffic delays";
    }

    // 10. Total distance including walks
    var totalKm = boarding.distKm + busDistanceKm + alighting.distKm;

    return {
        mode: "transit",
        label: routeNumber,
        distance: totalKm.toFixed(1) + " km",
        duration: formatMinutes(totalMinutes),
        durationSec: durationSec,
        cost: "\u20B9" + fare,
        costAmount: fare,
        boarding: boarding.stop.name,
        alighting: alighting.stop.name,
        frequency: frequency,
        crowdLevel: crowdLevel,
        walkToStop: boarding.distKm.toFixed(1) + " km",
        walkFromStop: alighting.distKm.toFixed(1) + " km",
        peakWarning: peakWarning,
        geometry: [],
        isBest: false,
    };
}

/**
 * Check if bus data is available near a given point.
 */
export function isBusAvailable(lat, lng) {
    return isInMumbai(lat, lng);
}
