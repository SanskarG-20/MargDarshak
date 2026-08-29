/**
 * Shared geographic utility functions for MargDarshak.
 *
 * Consolidates the duplicated haversine implementations that existed in:
 * - busService.js
 * - metroService.js
 * - routeService.js
 * - safetyService.js
 * - trainService.js
 * - continuousCopilotService.js
 * - liveRoutingService.js
 */

const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_M = 6371000;

/**
 * Convert degrees to radians.
 */
export function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

/**
 * Haversine distance in **kilometers** between two coordinate pairs.
 *
 * @param {number} lat1 - Latitude of point A
 * @param {number} lng1 - Longitude of point A
 * @param {number} lat2 - Latitude of point B
 * @param {number} lng2 - Longitude of point B
 * @returns {number} Distance in km
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Haversine distance in **meters** between two { lat, lng } objects.
 *
 * Accepts objects shaped like `{ lat, lng }` for convenience in services
 * that already use that convention (liveRoutingService, continuousCopilotService).
 *
 * @param {{ lat: number, lng: number }} a - Point A
 * @param {{ lat: number, lng: number }} b - Point B
 * @returns {number} Distance in meters (Infinity if either point is invalid)
 */
export function haversineMeters(a, b) {
    if (
        !Number.isFinite(a?.lat) || !Number.isFinite(a?.lng) ||
        !Number.isFinite(b?.lat) || !Number.isFinite(b?.lng)
    ) {
        return Infinity;
    }

    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
