import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Y, BK, WH } from "../constants/theme";
import AQILayer from "./AQILayer";
import SafetyReportLayer from "./SafetyReportLayer";
import SafetyReportModal from "./SafetyReportModal";
import {
    getActiveSafetyReports,
    submitSafetyReport,
    deleteSafetyReport,
} from "../services/supabaseClient";

// Fix default marker icons (Leaflet + bundler issue)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom yellow marker for user location
const userIcon = new L.DivIcon({
    className: "",
    html: `<div style="
        width:16px;height:16px;border-radius:50%;
        background:${Y};border:3px solid ${BK};
        box-shadow:0 0 12px ${Y},0 0 24px rgba(204,255,0,.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

// Custom marker for AI-recommended places
const placeIcon = new L.DivIcon({
    className: "",
    html: `<div style="
        width:12px;height:12px;border-radius:50%;
        background:#fff;border:2px solid ${Y};
        box-shadow:0 0 8px rgba(204,255,0,.4);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

/** Recenter map when user's real location arrives */
function RecenterMap({ userLocation }) {
    const map = useMap();
    const hasFlown = useRef(false);

    useEffect(() => {
        if (userLocation?.lat && userLocation?.lng && !hasFlown.current) {
            map.flyTo([userLocation.lat, userLocation.lng], 13, { duration: 1.5 });
            hasFlown.current = true;
        }
    }, [userLocation?.lat, userLocation?.lng, map]);

    return null;
}

/** Fit map bounds when markers change */
function FitMarkers({ markers, userLocation, routeGeometry }) {
    const map = useMap();

    useEffect(() => {
        // If route geometry exists, fit to route bounds
        if (routeGeometry && routeGeometry.length > 1) {
            const bounds = L.latLngBounds(routeGeometry);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1 });
            return;
        }

        if (!markers || markers.length === 0) return;

        const points = markers
            .filter((m) => m.lat && m.lng)
            .map((m) => [m.lat, m.lng]);

        if (userLocation) {
            points.push([userLocation.lat, userLocation.lng]);
        }

        if (points.length > 1) {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, duration: 1 });
        }
    }, [markers, userLocation, routeGeometry, map]);

    return null;
}

/**
 * MapView — Leaflet map with dark theme tiles.
 *
 * Props:
 *  - userLocation: { lat, lng }
 *  - markers: [{ name, lat, lng, description? }]
 *  - routeGeometry: [[lat, lng], ...] — polyline from route service
 *  - onMapReady: () => void
 */
// Mumbai fallback (MargDarshak is Mumbai-focused)
const MUMBAI_DEFAULT = { lat: 19.076, lng: 72.8777 };

export default function MapView({
    userLocation,
    markers = [],
    routeGeometry = [],
    onMapReady,
    showAQI = false,
    onAQIToggle = () => {},
}) {
    const { user, isSignedIn } = useUser();
    const center = userLocation || MUMBAI_DEFAULT;
    const [safetyReports, setSafetyReports] = useState([]);
    const [pendingReportLocation, setPendingReportLocation] = useState(null);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReportMode, setIsReportMode] = useState(false);
    const [toast, setToast] = useState("");

    const userId = useMemo(() => user?.id || "", [user?.id]);

    const fetchSafetyReports = useCallback(async () => {
        const { data, error } = await getActiveSafetyReports();
        if (error) return;
        setSafetyReports(data || []);
    }, []);

    useEffect(() => {
        fetchSafetyReports();
        const interval = setInterval(fetchSafetyReports, 90000);
        return () => clearInterval(interval);
    }, [fetchSafetyReports]);

    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(""), 3000);
        return () => clearTimeout(timer);
    }, [toast]);

    const handleMapClickForReport = useCallback((latlng) => {
        if (!isReportMode) return;
        if (!isSignedIn) {
            setToast("Sign in to report incidents");
            return;
        }
        setPendingReportLocation({ lat: latlng.lat, lng: latlng.lng });
        setIsReportModalOpen(true);
    }, [isReportMode, isSignedIn]);

    const handleDeleteReport = useCallback(async (reportId) => {
        if (!userId) return;
        await deleteSafetyReport(reportId, userId);
        fetchSafetyReports();
    }, [fetchSafetyReports, userId]);

    const handleSubmitReport = useCallback(async ({ category, description, severity }) => {
        if (!pendingReportLocation || !userId) return false;

        const { error } = await submitSafetyReport({
            userId,
            lat: pendingReportLocation.lat,
            lng: pendingReportLocation.lng,
            category,
            description,
            severity,
        });

        if (error) return false;
        await fetchSafetyReports();
        setPendingReportLocation(null);
        setIsReportModalOpen(false);
        return true;
    }, [fetchSafetyReports, pendingReportLocation, userId]);

    const closeReportModal = useCallback(() => {
        setIsReportModalOpen(false);
        setPendingReportLocation(null);
    }, []);

    return (
        <div style={{ marginTop: 32 }}>
            {/* Header */}
            <div
                style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: 22,
                    color: Y,
                    letterSpacing: 2,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                }}
            >
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#22c55e",
                        display: "inline-block",
                        boxShadow: "0 0 8px #22c55e",
                        animation: "pulse-ring 2s ease infinite",
                    }}
                />
                LIVE MAP
            </div>

            {/* Map container */}
            <div
                style={{
                    border: `1px solid rgba(255,255,255,.08)`,
                    height: "clamp(280px, 50vw, 400px)",
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                <button
                    type="button"
                    onClick={() => setIsReportMode((v) => !v)}
                    style={{
                        position: "absolute",
                        top: 12,
                        left: 12,
                        zIndex: 1000,
                        background: isReportMode ? Y : BK,
                        color: isReportMode ? BK : WH,
                        border: `1.5px solid ${Y}`,
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                >
                    {isReportMode ? "◉ REPORT MODE" : "◎ REPORT MODE"}
                </button>

                <button
                    type="button"
                    onClick={onAQIToggle}
                    aria-label="Toggle AQI heatmap overlay"
                    style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        zIndex: 1000,
                        background: showAQI ? Y : BK,
                        color: showAQI ? BK : WH,
                        border: `1.5px solid ${Y}`,
                        borderRadius: 8,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                >
                    {showAQI ? "◉ AQI ON" : "◎ AQI OFF"}
                </button>

                {showAQI && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 32,
                            left: 12,
                            zIndex: 1000,
                            background: "rgba(0,0,0,0.85)",
                            borderRadius: 8,
                            padding: "10px 14px",
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: WH,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                            pointerEvents: "none",
                        }}
                    >
                        <LegendRow color="rgba(0, 200, 100, 0.75)" label="Good" />
                        <LegendRow color="rgba(180, 220, 0, 0.8)" label="Satisfactory" />
                        <LegendRow color="rgba(255, 165, 0, 0.85)" label="Moderate" />
                        <LegendRow color="rgba(220, 50, 50, 0.9)" label="Poor" />
                        <LegendRow color="rgba(150, 0, 200, 0.95)" label="Very Poor" />
                    </div>
                )}

                <MapContainer
                    center={[center.lat, center.lng]}
                    zoom={12}
                    style={{ height: "100%", width: "100%", background: BK }}
                    zoomControl={true}
                    whenReady={() => onMapReady?.()}
                >
                    <MapCursorMode active={isReportMode} />

                    {/* Dark theme tiles — CartoDB Dark Matter */}
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />

                    {/* Recenter when real user location arrives */}
                    <RecenterMap userLocation={userLocation} />

                    {/* Fit bounds when AI markers or route arrive */}
                    <FitMarkers markers={markers} userLocation={userLocation} routeGeometry={routeGeometry} />

                    <AQILayer visible={showAQI} currentHour={new Date().getHours()} />
                    <SafetyReportLayer
                        reports={safetyReports}
                        currentUserId={userId}
                        onDelete={handleDeleteReport}
                        onMapClick={handleMapClickForReport}
                        previewLocation={pendingReportLocation}
                        showPreview={isReportModalOpen}
                    />

                    {/* Route polyline */}
                    {routeGeometry.length > 1 && (
                        <Polyline
                            positions={routeGeometry}
                            pathOptions={{
                                color: Y,
                                weight: 3,
                                opacity: 0.8,
                                dashArray: "8, 6",
                            }}
                        />
                    )}

                    {/* User location marker */}
                    {userLocation && (
                        <Marker
                            position={[userLocation.lat, userLocation.lng]}
                            icon={userIcon}
                        >
                            <Popup>
                                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
                                    <strong>Your Location</strong>
                                    <br />
                                    {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* AI recommended place markers */}
                    {markers
                        .filter((m) => m.lat && m.lng)
                        .map((marker, i) => (
                            <Marker
                                key={`${marker.name}-${i}`}
                                position={[marker.lat, marker.lng]}
                                icon={placeIcon}
                            >
                                <Popup>
                                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, maxWidth: 200 }}>
                                        <strong>{marker.name}</strong>
                                        {marker.description && (
                                            <div style={{ marginTop: 4, color: "#666", fontSize: 12 }}>
                                                {marker.description}
                                            </div>
                                        )}
                                        {marker.estimatedCost && (
                                            <div style={{ marginTop: 4, fontWeight: 600, color: "#333" }}>
                                                {marker.estimatedCost}
                                            </div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        ))}
                </MapContainer>

                {/* Overlay border accent */}
                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "30%",
                        height: 3,
                        background: Y,
                        zIndex: 1000,
                        pointerEvents: "none",
                    }}
                />
            </div>

            {toast && (
                <div
                    style={{
                        position: "fixed",
                        top: 90,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 2100,
                        background: "rgba(0,0,0,0.9)",
                        border: `1px solid rgba(204,255,0,.35)`,
                        color: WH,
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 12,
                    }}
                >
                    {toast}
                </div>
            )}

            <SafetyReportModal
                lat={pendingReportLocation?.lat}
                lng={pendingReportLocation?.lng}
                isOpen={isReportModalOpen}
                onClose={closeReportModal}
                onSubmit={handleSubmitReport}
            />
        </div>
    );
}

function MapCursorMode({ active }) {
    const map = useMap();

    useEffect(() => {
        const container = map.getContainer();
        if (!container) return undefined;

        if (active) {
            L.DomUtil.addClass(container, "map-crosshair");
        } else {
            L.DomUtil.removeClass(container, "map-crosshair");
        }

        return () => {
            L.DomUtil.removeClass(container, "map-crosshair");
        };
    }, [active, map]);

    return null;
}

function LegendRow({ color, label }) {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
            }}
        >
            <span
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    display: "inline-block",
                }}
            />
            <span>{label}</span>
        </div>
    );
}
