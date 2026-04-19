import { useEffect, useMemo, useState } from "react";
import { Y, BK, WH } from "../constants/theme";
import { compareRoutes } from "../services/routeService";
import { useJourney } from "../context/JourneyContext";
import ComparePanel from "./ComparePanel";

/** Minimal SVG icons for each travel mode */
function ModeIcon({ mode, size = 20, color = WH }) {
    if (mode === "walk") return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="4" r="2" fill={color} stroke="none" />
            <path d="M9 12l1.5-4.5L14 9l2 4" />
            <path d="M7 20l3-4 2 1 1 3" />
            <path d="M15 20l-1-5" />
        </svg>
    );
    if (mode === "cab") return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3v-3l2.5-6h11L19 14v3h-2" />
            <circle cx="7.5" cy="17.5" r="1.5" />
            <circle cx="16.5" cy="17.5" r="1.5" />
            <path d="M5 11h14" />
        </svg>
    );
    if (mode === "transit") return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="13" rx="2" />
            <path d="M3 9h18" />
            <path d="M8 19l-1 2" />
            <path d="M16 19l1 2" />
            <path d="M7 19h10" />
        </svg>
    );
    if (mode === "metro") return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
            <path d="M12 2v20" /><path d="M4 7l8 5 8-5" />
            <circle cx="12" cy="12" r="2.5" fill={color} stroke="none" />
        </svg>
    );
    if (mode === "train") return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="14" rx="2" />
            <path d="M4 10h16" />
            <path d="M9 21l-2-4" /><path d="M15 21l2-4" />
            <circle cx="9" cy="14" r="1" fill={color} /><circle cx="15" cy="14" r="1" fill={color} />
        </svg>
    );
    return null;
}

/**
 * RoutePanel — Compares Walk vs Cab vs Transit between user location and a destination.
 *
 * Props:
 *  - userLocation: { lat, lng }
 *  - markers: [{ name, lat, lng }] — AI recommended places
 *  - onRouteCalculated: (routeData) => void — passes route geometry to map
 */
export default function RoutePanel({
    userLocation,
    markers = [],
    onRouteCalculated,
    usePreferences = false,
    preferences = null,
    safeMode = false,
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [selectedForCompare, setSelectedForCompare] = useState([]);
    const [showComparePanel, setShowComparePanel] = useState(false);
    const { currentJourney, setCurrentJourney } = useJourney();

    const validMarkers = markers.filter((m) => m.lat && m.lng);
    const selectedPlace = currentJourney?.destination?.name || null;
    const routes = currentJourney?.routes || null;
    const isFallback = !!currentJourney?.usingFallback;
    const selectedJourneyKey = useMemo(() => {
        if (!currentJourney?.destination?.name) return "none";
        return currentJourney.destination.name + ":" + (currentJourney.startedAt || "0");
    }, [currentJourney?.destination?.name, currentJourney?.startedAt]);

    useEffect(() => {
        setSelectedForCompare([]);
        setCompareMode(false);
        setShowComparePanel(false);
    }, [selectedJourneyKey]);

    const toggleCompareSelect = (mode) => {
        setSelectedForCompare((prev) => {
            if (prev.includes(mode)) {
                const next = prev.filter((m) => m !== mode);
                setCompareMode(next.length > 0);
                return next;
            }
            if (prev.length >= 2) return prev;
            const next = [...prev, mode];
            setCompareMode(true);
            return next;
        });
    };

    const handleCalculate = async (marker) => {
        if (!userLocation?.lat || !userLocation?.lng) return;

        setLoading(true);
        setError(null);

        const result = await compareRoutes(
            userLocation.lat,
            userLocation.lng,
            marker.lat,
            marker.lng,
            usePreferences ? preferences : null,
            { safeMode }
        );

        setLoading(false);

        if (result.error) {
            setError(result.message);
        } else {
            const bestRoute = result.modes.find((m) => m.isBest);
            const routeWithGeometry = result.modes.find((m) => m.geometry?.length > 0);
            const journey = {
                id: "journey-" + Date.now(),
                origin: {
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                },
                destination: {
                    name: marker.name,
                    lat: marker.lat,
                    lng: marker.lng,
                },
                routes: result.modes,
                bestRoute: bestRoute || result.modes[0] || null,
                geometry: bestRoute?.geometry?.length > 0
                    ? bestRoute.geometry
                    : routeWithGeometry?.geometry || [],
                usingFallback: !!result.usingFallback,
                startedAt: Date.now(),
                lastKnownPosition: {
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                },
                status: "active",
                safeMode,
            };

            setCurrentJourney(journey);
            onRouteCalculated?.(journey);
        }
    };

    if (validMarkers.length === 0) return null;

    return (
        <div data-tour="route-panel" style={{ marginTop: 32 }}>
            {/* Header */}
            <div style={headerStyle}>
                <Dot color={routes ? "#22c55e" : Y} pulse={loading} />
                ROUTE INTELLIGENCE
            </div>

            {safeMode && (
                <div style={{
                    marginBottom: 14,
                    padding: "10px 12px",
                    border: "1px solid rgba(239,68,68,.22)",
                    background: "rgba(239,68,68,.05)",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12,
                    color: "rgba(255,255,255,.72)",
                    lineHeight: 1.5,
                }}>
                    Safety First Mode is active. Routes may take longer, but low-safety and night-risk segments are heavily penalized.
                </div>
            )}

            {/* Destination selector */}
            <div style={{ marginBottom: 16 }}>
                <div style={sublabelStyle}>SELECT DESTINATION</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {validMarkers.map((marker, i) => (
                        <button
                            key={`${marker.name}-${i}`}
                            onClick={() => handleCalculate(marker)}
                            disabled={loading}
                            data-hover
                            style={{
                                padding: "8px 16px",
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 13,
                                color: selectedPlace === marker.name ? BK : "rgba(255,255,255,.7)",
                                background:
                                    selectedPlace === marker.name
                                        ? Y
                                        : "rgba(255,255,255,.05)",
                                border: `1px solid ${
                                    selectedPlace === marker.name
                                        ? Y
                                        : "rgba(255,255,255,.12)"
                                }`,
                                cursor: loading ? "wait" : "pointer",
                                transition: "all .15s",
                            }}
                        >
                            {marker.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div style={loadingStyle}>
                    Calculating routes...
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={errorStyle}>{error}</div>
            )}

            {/* Fallback notice */}
            {routes && isFallback && (
                <div style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 12,
                    color: "rgba(255,255,255,.35)",
                    marginBottom: 12,
                    padding: "8px 12px",
                    border: "1px solid rgba(255,255,255,.06)",
                    background: "rgba(255,255,255,.02)",
                    letterSpacing: 0.3,
                }}>
                    Estimates based on straight-line distance (ORS road data unavailable)
                </div>
            )}

            {/* Route comparison cards */}
            {routes && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {routes.map((route) => (
                        <div
                            key={route.mode}
                            style={{
                                padding: "16px 20px",
                                border: `1px solid ${
                                    route.isBest ? Y : "rgba(255,255,255,.08)"
                                }`,
                                background: route.isBest
                                    ? "rgba(204,255,0,.06)"
                                    : "rgba(255,255,255,.02)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: 12,
                                position: "relative",
                            }}
                        >
                            {/* Best badge */}
                            {route.isBest && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: -1,
                                        right: 12,
                                        background: Y,
                                        color: BK,
                                        fontFamily: "'Bebas Neue',sans-serif",
                                        fontSize: 10,
                                        letterSpacing: 2,
                                        padding: "2px 10px",
                                    }}
                                >
                                    BEST
                                </div>
                            )}

                            {/* Mode label */}
                            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 6,
                                    background: route.isBest ? Y : "rgba(255,255,255,.07)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    <ModeIcon
                                        mode={route.mode}
                                        size={18}
                                        color={route.isBest ? BK : "rgba(255,255,255,.6)"}
                                    />
                                </div>
                                <div
                                    style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 15,
                                        fontWeight: 600,
                                        color: route.isBest ? WH : "rgba(255,255,255,.7)",
                                        letterSpacing: 0.2,
                                    }}
                                >
                                    {route.label}
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                                <StatItem
                                    label="DISTANCE"
                                    value={route.distance}
                                    highlight={false}
                                />
                                <StatItem
                                    label="ETA"
                                    value={route.duration}
                                    highlight={route.isBest}
                                />
                                <StatItem
                                    label="COST"
                                    value={route.cost}
                                    highlight={route.isBest}
                                    color={route.costAmount === 0 ? "#22c55e" : Y}
                                />
                                {route.frequency && (
                                    <StatItem
                                        label="FREQUENCY"
                                        value={route.frequency}
                                        highlight={false}
                                    />
                                )}
                                {route.crowdBadge && (
                                    <StatItem
                                        label="CROWD"
                                        value={route.crowdBadge}
                                        highlight={false}
                                        color={
                                            route.crowdLevel === "packed" || route.crowdLevel === "high"
                                                ? "#ef4444"
                                                : route.crowdLevel === "moderate"
                                                    ? "#eab308"
                                                    : "#22c55e"
                                        }
                                    />
                                )}
                                {route.ecoScore != null && (
                                    <StatItem
                                        label="ECO"
                                        value={route.ecoScore + "%"}
                                        highlight={false}
                                        color={
                                            route.ecoScore >= 80 ? "#22c55e" :
                                            route.ecoScore >= 50 ? "#06b6d4" :
                                            route.ecoScore > 0  ? "#eab308" :
                                            "rgba(255,255,255,.3)"
                                        }
                                    />
                                )}
                                {route.safeModeApplied && (
                                    <StatItem
                                        label="SAFE MODE"
                                        value={route.safetyScore != null ? route.safetyScore + "/10" : "ON"}
                                        highlight={false}
                                        color={
                                            route.safetyScore >= 8 ? "#22c55e" :
                                            route.safetyScore >= 5 ? "#eab308" :
                                            "#ef4444"
                                        }
                                    />
                                )}
                            </div>

                            {/* Eco savings bar */}
                            {route.ecoSavingsPercent > 0 && route.co2Grams != null && (
                                <div style={{
                                    marginTop: 8,
                                    fontFamily: "'DM Sans',sans-serif",
                                    fontSize: 11,
                                    color: route.ecoScore >= 80 ? "#22c55e" : "#06b6d4",
                                    padding: "4px 10px",
                                    background: route.ecoScore >= 80 ? "rgba(34,197,94,.06)" : "rgba(6,182,212,.06)",
                                    border: route.ecoScore >= 80 ? "1px solid rgba(34,197,94,.15)" : "1px solid rgba(6,182,212,.15)",
                                }}>
                                    {"\u25C7"} {route.ecoSavingsPercent}% less CO{"\u2082"} vs cab {"\u2002\u00B7\u2002"}{route.co2Grams}g vs {Math.round(route.co2Grams / (1 - route.ecoSavingsPercent / 100))}g
                                </div>
                            )}

                            {/* Metro details */}
                            {route.mode === "metro" && (
                                <div style={{
                                    marginTop: 8,
                                    padding: "8px 12px",
                                    background: "rgba(255,255,255,.02)",
                                    border: "1px solid rgba(255,255,255,.06)",
                                    fontSize: 12,
                                    fontFamily: "'DM Sans',sans-serif",
                                    color: "rgba(255,255,255,.5)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                        <span style={{
                                            width: 8, height: 8, borderRadius: "50%",
                                            background: route.lineColor || Y,
                                            display: "inline-block", flexShrink: 0,
                                        }} />
                                        <span>{route.boarding}</span>
                                        <span style={{ color: "rgba(255,255,255,.25)" }}>→</span>
                                        {route.interchange && (
                                            <>
                                                <span style={{ color: "#f59e0b" }}>{route.interchange}</span>
                                                <span style={{ color: "rgba(255,255,255,.25)" }}>→</span>
                                            </>
                                        )}
                                        <span>{route.alighting}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "rgba(255,255,255,.35)" }}>
                                        <span>{route.stationCount} stations</span>
                                        {route.walkToStation && (
                                            <span>Walk to station: {route.walkToStation}</span>
                                        )}
                                        {route.walkFromStation && (
                                            <span>Walk from station: {route.walkFromStation}</span>
                                        )}
                                    </div>
                                    {route.peakWarning && (
                                        <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>
                                            {"\u25B2"} {route.peakWarning}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Local Train details */}
                            {route.mode === "train" && route.boarding && route.alighting && (
                                <div style={{
                                    marginTop: 8,
                                    padding: "8px 12px",
                                    background: "rgba(255,255,255,.02)",
                                    border: "1px solid rgba(255,255,255,.06)",
                                    fontSize: 12,
                                    fontFamily: "'DM Sans',sans-serif",
                                    color: "rgba(255,255,255,.5)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                        <span style={{
                                            width: 8, height: 8, borderRadius: "50%",
                                            background: route.lineColor || "#1565c0",
                                            display: "inline-block", flexShrink: 0,
                                        }} />
                                        <span>{route.boarding}</span>
                                        <span style={{ color: "rgba(255,255,255,.25)" }}>→</span>
                                        <span>{route.alighting}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "rgba(255,255,255,.35)" }}>
                                        <span>{route.stationCount} stations</span>
                                        {route.crowdBadge && (
                                            <span>Crowd: <span style={{ color: route.crowdLevel === "packed" ? "#ef4444" : route.crowdLevel === "high" ? "#f97316" : route.crowdLevel === "moderate" ? "#eab308" : "#22c55e", fontWeight: 600 }}>{route.crowdBadge}</span></span>
                                        )}
                                        {route.walkToStation && (
                                            <span>Walk to station: {route.walkToStation}</span>
                                        )}
                                        {route.walkFromStation && (
                                            <span>Walk from station: {route.walkFromStation}</span>
                                        )}
                                    </div>
                                    {route.peakWarning && (
                                        <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>
                                            {"\u25B2"} {route.peakWarning}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Bus details */}
                            {route.mode === "transit" && route.boarding && route.alighting && (
                                <div style={{
                                    marginTop: 8,
                                    padding: "8px 12px",
                                    background: "rgba(255,255,255,.02)",
                                    border: "1px solid rgba(255,255,255,.06)",
                                    fontSize: 12,
                                    fontFamily: "'DM Sans',sans-serif",
                                    color: "rgba(255,255,255,.5)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 4,
                                }}>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                        <span style={{
                                            width: 8, height: 8, borderRadius: "50%",
                                            background: "#22c55e",
                                            display: "inline-block", flexShrink: 0,
                                        }} />
                                        <span>{route.boarding}</span>
                                        <span style={{ color: "rgba(255,255,255,.25)" }}>→</span>
                                        <span>{route.alighting}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: "rgba(255,255,255,.35)" }}>
                                        {route.crowdBadge && (
                                            <span>Crowd: <span style={{color: route.crowdLevel === "high" || route.crowdLevel === "packed" ? "#f97316" : route.crowdLevel === "moderate" ? "#eab308" : "#22c55e", fontWeight: 600}}>{route.crowdBadge}</span></span>
                                        )}
                                        {route.walkToStop && (
                                            <span>Walk to stop: {route.walkToStop}</span>
                                        )}
                                        {route.walkFromStop && (
                                            <span>Walk from stop: {route.walkFromStop}</span>
                                        )}
                                    </div>
                                    {route.peakWarning && (
                                        <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>
                                            {"\u25B2"} {route.peakWarning}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{
                                marginTop: 8,
                                display: "flex",
                                justifyContent: "flex-end",
                            }}>
                                <button
                                    type="button"
                                    onClick={() => toggleCompareSelect(route.mode)}
                                    disabled={selectedForCompare.length >= 2 && !selectedForCompare.includes(route.mode)}
                                    style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 6,
                                        border: "1px solid rgba(204,255,0,.4)",
                                        background: selectedForCompare.includes(route.mode) ? Y : "transparent",
                                        color: selectedForCompare.includes(route.mode) ? BK : Y,
                                        fontSize: 16,
                                        fontWeight: 700,
                                        cursor: selectedForCompare.length >= 2 && !selectedForCompare.includes(route.mode)
                                            ? "not-allowed"
                                            : "pointer",
                                        opacity: selectedForCompare.length >= 2 && !selectedForCompare.includes(route.mode)
                                            ? 0.3
                                            : 1,
                                    }}
                                    title="Compare"
                                >
                                    {selectedForCompare.includes(route.mode) ? "✓" : "＋"}
                                </button>
                            </div>
                        </div>
                    ))}

                    {compareMode && selectedForCompare.length === 2 && (
                        <div style={{
                            position: "sticky",
                            bottom: 0,
                            zIndex: 5,
                            marginTop: 8,
                            padding: "10px 12px",
                            border: "1px solid rgba(204,255,0,.25)",
                            background: "rgba(0,0,0,.92)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                        }}>
                            <div style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 12,
                                color: "rgba(255,255,255,.75)",
                                letterSpacing: 0.3,
                            }}>
                                {`COMPARING ${selectedForCompare[0]} vs ${selectedForCompare[1]}`}
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowComparePanel(true)}
                                style={{
                                    background: Y,
                                    color: BK,
                                    border: "none",
                                    padding: "8px 14px",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                }}
                            >
                                VIEW COMPARISON →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showComparePanel && selectedForCompare.length === 2 && (
                <ComparePanel
                    optionA={routes?.find((r) => r.mode === selectedForCompare[0])}
                    optionB={routes?.find((r) => r.mode === selectedForCompare[1])}
                    onClose={() => setShowComparePanel(false)}
                />
            )}
        </div>
    );
}

/* ── Sub-components ─────────────────────────── */

function Dot({ color, pulse }) {
    return (
        <span
            style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                display: "inline-block",
                boxShadow: `0 0 8px ${color}`,
                animation: pulse
                    ? "pulse-ring 1s ease infinite"
                    : "pulse-ring 2s ease infinite",
            }}
        />
    );
}

function StatItem({ label, value, highlight, color }) {
    return (
        <div>
            <div
                style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 10,
                    color: "rgba(255,255,255,.3)",
                    letterSpacing: 1,
                    marginBottom: 2,
                }}
            >
                {label}
            </div>
            <div
                style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: 18,
                    color: color || (highlight ? Y : "rgba(255,255,255,.6)"),
                    letterSpacing: 1,
                }}
            >
                {value}
            </div>
        </div>
    );
}

/* ── Styles ──────────────────────────────────── */

const headerStyle = {
    fontFamily: "'Bebas Neue',sans-serif",
    fontSize: 22,
    color: Y,
    letterSpacing: 2,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 10,
};

const sublabelStyle = {
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 11,
    color: "rgba(255,255,255,.35)",
    letterSpacing: 2,
    marginBottom: 8,
};

const loadingStyle = {
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    color: Y,
    padding: "12px 0",
    animation: "pulse-ring 1.5s ease infinite",
};

const errorStyle = {
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    color: "#ef4444",
    padding: "12px 16px",
    border: "1px solid rgba(239,68,68,.2)",
    background: "rgba(239,68,68,.05)",
};
