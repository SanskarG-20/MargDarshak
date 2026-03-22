import { useState, useRef, useEffect, useCallback } from "react";
import { Y, BK, WH } from "../constants/theme";
import {
    getLiveLocation,
    getAreaName,
    buildEmergencyMessage,
    playAlertSound,
    getSafetyGuidance,
} from "../services/sosService";
import { logSOSTrigger } from "../services/supabaseClient";

/**
 * SOSButton — Floating emergency button + expandable panel.
 *
 * Props:
 *  - dbUser : Supabase user row ({ id, ... })
 *  - userLocation : { lat, lng } from useGeolocation
 */
export default function SOSButton({ dbUser, userLocation }) {
    const [active, setActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sosData, setSosData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [guidance, setGuidance] = useState([]);
    const panelRef = useRef(null);

    // Close on Escape
    useEffect(() => {
        if (!active) return;
        const handleKey = (e) => { if (e.key === "Escape") setActive(false); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [active]);

    const handleActivate = useCallback(async () => {
        if (loading) return;
        setLoading(true);
        setCopied(false);

        // 1. Play alert sound immediately
        playAlertSound();

        // 2. Get live GPS (≤3s, falls back to last-known/cache)
        const loc = await getLiveLocation(userLocation);

        // 3. Reverse geocode to get area name (≤3s, cached offline)
        const area = await getAreaName(loc.lat, loc.lng);

        // 4. Build emergency message
        const message = buildEmergencyMessage(loc.lat, loc.lng, area);

        // 5. Get safety guidance
        const tips = getSafetyGuidance(area);

        const data = {
            lat: loc.lat,
            lng: loc.lng,
            area: area || "Unknown area",
            source: loc.source,
            message,
            timestamp: new Date().toISOString(),
        };

        setSosData(data);
        setGuidance(tips);
        setActive(true);
        setLoading(false);

        // 6. Log to Supabase (fire-and-forget)
        if (dbUser?.id) {
            logSOSTrigger({
                userId: dbUser.id,
                lat: loc.lat,
                lng: loc.lng,
                area: area || null,
            });
        }
    }, [loading, userLocation, dbUser?.id]);

    const handleCopy = useCallback(async () => {
        if (!sosData?.message) return;
        try {
            await navigator.clipboard.writeText(sosData.message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const ta = document.createElement("textarea");
            ta.value = sosData.message;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [sosData]);

    const handleCall = useCallback(() => {
        window.open("tel:112", "_self");
    }, []);

    const handleOpenMaps = useCallback(() => {
        if (!sosData) return;
        window.open(
            `https://maps.google.com/maps?q=${sosData.lat.toFixed(6)},${sosData.lng.toFixed(6)}`,
            "_blank"
        );
    }, [sosData]);

    const handleClose = useCallback(() => {
        setActive(false);
    }, []);

    return (
        <>
            {/* ── Floating SOS Button ────────────────── */}
            <button
                data-tour="sos-button"
                onClick={handleActivate}
                disabled={loading}
                aria-label="SOS Emergency"
                style={{
                    position: "fixed",
                    bottom: 28,
                    right: 28,
                    zIndex: 9999,
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    border: "2px solid #ef4444",
                    background: loading ? "rgba(239,68,68,.3)" : "rgba(239,68,68,.15)",
                    color: "#ef4444",
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: 16,
                    letterSpacing: 2,
                    cursor: loading ? "wait" : "pointer",
                    transition: "all .2s",
                    boxShadow: "0 0 20px rgba(239,68,68,.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(8px)",
                }}
                onMouseEnter={(e) => {
                    if (!loading) {
                        e.currentTarget.style.background = "rgba(239,68,68,.3)";
                        e.currentTarget.style.boxShadow = "0 0 30px rgba(239,68,68,.4)";
                    }
                }}
                onMouseLeave={(e) => {
                    if (!loading) {
                        e.currentTarget.style.background = "rgba(239,68,68,.15)";
                        e.currentTarget.style.boxShadow = "0 0 20px rgba(239,68,68,.25)";
                    }
                }}
            >
                {loading ? (
                    <span style={{ animation: "ldm-blink 0.5s infinite" }}>...</span>
                ) : (
                    "SOS"
                )}
            </button>

            {/* ── Emergency Panel (overlay) ──────────── */}
            {active && sosData && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 10000,
                        background: "rgba(0,0,0,.85)",
                        backdropFilter: "blur(6px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 20,
                        animation: "ldm-step-in 0.2s ease both",
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
                >
                    <div
                        ref={panelRef}
                        style={{
                            width: "100%",
                            maxWidth: 440,
                            maxHeight: "90vh",
                            overflowY: "auto",
                            background: BK,
                            border: "1px solid rgba(239,68,68,.3)",
                            borderTop: "3px solid #ef4444",
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: "16px 20px",
                            borderBottom: "1px solid rgba(239,68,68,.15)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: "#ef4444",
                                    display: "inline-block",
                                    animation: "ldm-blink 1s infinite",
                                }} />
                                <span style={{
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 18,
                                    letterSpacing: 3,
                                    color: "#ef4444",
                                }}>
                                    SOS EMERGENCY
                                </span>
                            </div>
                            <button
                                onClick={handleClose}
                                style={{
                                    background: "none", border: "none", color: "rgba(255,255,255,.4)",
                                    fontFamily: "'DM Sans',sans-serif", fontSize: 18,
                                    cursor: "pointer", padding: "4px 8px",
                                }}
                            >
                                {"\u2715"}
                            </button>
                        </div>

                        {/* Location info */}
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                            <div style={{
                                fontFamily: "'Bebas Neue',sans-serif",
                                fontSize: 11, letterSpacing: 2,
                                color: "rgba(255,255,255,.35)", marginBottom: 8,
                            }}>
                                YOUR LOCATION
                            </div>
                            <div style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 14, fontWeight: 600,
                                color: "rgba(255,255,255,.85)", marginBottom: 4,
                            }}>
                                {sosData.area}
                            </div>
                            <div style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 11, color: "rgba(255,255,255,.35)",
                            }}>
                                {sosData.lat.toFixed(6)}, {sosData.lng.toFixed(6)}
                                <span style={{ marginLeft: 8, color: "rgba(255,255,255,.2)" }}>
                                    via {sosData.source}
                                </span>
                            </div>
                        </div>

                        {/* Emergency message preview */}
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                            <div style={{
                                fontFamily: "'Bebas Neue',sans-serif",
                                fontSize: 11, letterSpacing: 2,
                                color: "rgba(255,255,255,.35)", marginBottom: 8,
                            }}>
                                EMERGENCY MESSAGE
                            </div>
                            <div style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 12, lineHeight: 1.6,
                                color: "rgba(255,255,255,.55)",
                                padding: "10px 12px",
                                background: "rgba(255,255,255,.03)",
                                border: "1px solid rgba(255,255,255,.06)",
                                whiteSpace: "pre-line",
                            }}>
                                {sosData.message}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{
                            padding: "16px 20px",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                            borderBottom: "1px solid rgba(255,255,255,.06)",
                        }}>
                            <SOSActionButton
                                label={copied ? "\u2713 COPIED" : "\u25A0 COPY MESSAGE"}
                                color={copied ? "#22c55e" : WH}
                                onClick={handleCopy}
                            />
                            <SOSActionButton
                                label={"\u25C6 CALL 112"}
                                color="#ef4444"
                                onClick={handleCall}
                            />
                            <SOSActionButton
                                label={"\u25CB OPEN IN MAPS"}
                                color={Y}
                                onClick={handleOpenMaps}
                            />
                            <SOSActionButton
                                label={"\u25B8 PLAY ALERT"}
                                color="#f97316"
                                onClick={playAlertSound}
                            />
                        </div>

                        {/* AI Safety Guidance */}
                        {guidance.length > 0 && (
                            <div style={{ padding: "16px 20px" }}>
                                <div style={{
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 11, letterSpacing: 2,
                                    color: Y, marginBottom: 10,
                                    display: "flex", alignItems: "center", gap: 6,
                                }}>
                                    <span style={{
                                        width: 6, height: 6, borderRadius: "50%",
                                        background: Y,
                                        display: "inline-block",
                                    }} />
                                    AI SAFETY GUIDANCE
                                </div>
                                {guidance.map((tip, i) => (
                                    <div key={i} style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 12,
                                        color: "rgba(255,255,255,.6)",
                                        paddingLeft: 14,
                                        marginBottom: 6,
                                        borderLeft: `2px solid rgba(204,255,0,.15)`,
                                        lineHeight: 1.5,
                                    }}>
                                        {tip}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

/* ── Action button sub-component ──────────────── */

function SOSActionButton({ label, color, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: "10px 12px",
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 12,
                letterSpacing: 1.5,
                color: color,
                background: "transparent",
                border: `1px solid ${color}30`,
                cursor: "pointer",
                transition: "all .15s",
                textAlign: "center",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = color + "12";
                e.currentTarget.style.borderColor = color + "50";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = color + "30";
            }}
        >
            {label}
        </button>
    );
}
