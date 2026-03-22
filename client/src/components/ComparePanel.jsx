import { useEffect, useMemo, useState } from "react";
import { Y, BK, WH } from "../constants/theme";

export function parseDurationToMinutes(str) {
    if (!str || typeof str !== "string") return null;
    const raw = str.toLowerCase().trim();
    if (!raw) return null;

    const hrMatch = raw.match(/(\d+)\s*h(?:r|our)?/);
    const minMatch = raw.match(/(\d+)\s*m(?:in|ins|inute|inutes)?/);

    const hrs = hrMatch ? parseInt(hrMatch[1], 10) : 0;
    const mins = minMatch ? parseInt(minMatch[1], 10) : 0;

    if (!hrMatch && !minMatch) {
        const num = raw.match(/\d+/);
        return num ? parseInt(num[0], 10) : null;
    }

    return (hrs * 60) + mins;
}

export function parseCostToNumber(str, mode) {
    const modeText = (mode || "").toLowerCase();
    if (modeText === "walk") return 0;
    if (!str || typeof str !== "string") return null;

    const raw = str.toLowerCase().trim();
    if (raw.includes("free")) return 0;

    const num = raw.replace(/[^\d]/g, "");
    if (!num) return null;
    return parseInt(num, 10);
}

function parseDistanceKm(distance) {
    if (distance == null) return null;
    if (typeof distance === "number") return distance;
    if (typeof distance !== "string") return null;

    const raw = distance.toLowerCase();
    const value = parseFloat(raw.replace(/[^\d.]/g, ""));
    if (Number.isNaN(value)) return null;

    if (raw.includes("m") && !raw.includes("km")) {
        return value / 1000;
    }
    return value;
}

function safeRender(getter) {
    try {
        const value = getter();
        if (value == null || value === "") return "-";
        return value;
    } catch {
        return "-";
    }
}

function modeName(mode) {
    const m = (mode || "").toLowerCase();
    if (m === "cab") return "Cab";
    if (m === "metro") return "Metro";
    if (m === "train") return "Train";
    if (m === "walk") return "Walk";
    if (m === "auto") return "Auto";
    if (m === "transit" || m === "bus") return "Bus";
    return mode || "Option";
}

function modeBestFor(mode) {
    const m = (mode || "").toLowerCase();
    if (m === "metro") return "Speed + Eco";
    if (m === "cab") return "Comfort + Direct";
    if (m === "train") return "Distance";
    if (m === "walk") return "Zero Cost";
    if (m === "auto") return "Last Mile";
    if (m === "transit" || m === "bus") return "Budget";
    return "Balanced Choice";
}

function isPeakHour() {
    const h = new Date().getHours();
    return (h >= 8 && h <= 10) || (h >= 18 && h <= 21);
}

function peakLabel(mode) {
    const m = (mode || "").toLowerCase();
    if (!isPeakHour()) return "NORMAL FLOW";
    if (m === "cab" || m === "auto") return "PEAK TRAFFIC";
    if (m === "bus" || m === "transit" || m === "train") return "CROWDED";
    if (m === "metro" || m === "walk") return "SMOOTH";
    return "NORMAL FLOW";
}

function aqiImpactLabel(mode, weather) {
    if (!weather) return "-";
    const m = (mode || "").toLowerCase();
    const sheltered = m === "metro" || m === "cab" || m === "train";
    return sheltered ? "SHELTERED" : "EXPOSED";
}

function progressColor(type, score) {
    if (type === "eco") return Y;
    if (score >= 8) return "#22c55e";
    if (score >= 5) return "#f59e0b";
    return "#ef4444";
}

function pickWinner(optionA, optionB) {
    const aCost = parseCostToNumber(optionA?.cost, optionA?.mode) ?? 999999;
    const bCost = parseCostToNumber(optionB?.cost, optionB?.mode) ?? 999999;
    const aDur = parseDurationToMinutes(optionA?.duration) ?? 999999;
    const bDur = parseDurationToMinutes(optionB?.duration) ?? 999999;

    const aScore = aCost + (aDur * 2);
    const bScore = bCost + (bDur * 2);

    return aScore <= bScore ? optionA : optionB;
}

function bestPickMode(optionA, optionB) {
    const aCost = parseCostToNumber(optionA?.cost, optionA?.mode) ?? 999999;
    const bCost = parseCostToNumber(optionB?.cost, optionB?.mode) ?? 999999;
    const aDur = parseDurationToMinutes(optionA?.duration) ?? 999999;
    const bDur = parseDurationToMinutes(optionB?.duration) ?? 999999;

    const aMetric = aCost + aDur;
    const bMetric = bCost + bDur;
    return aMetric <= bMetric ? "A" : "B";
}

function compareDuration(optionA, optionB, side) {
    return safeRender(() => {
        const a = parseDurationToMinutes(optionA.duration);
        const b = parseDurationToMinutes(optionB.duration);
        if (a == null || b == null) return "-";
        if (a === b) return "Same speed";

        const betterA = a < b;
        const diff = Math.abs(a - b);
        if ((side === "A" && betterA) || (side === "B" && !betterA)) {
            return `${diff} min faster ▲`;
        }
        return `${diff} min slower`;
    });
}

function compareCost(optionA, optionB, side) {
    return safeRender(() => {
        const a = parseCostToNumber(optionA.cost, optionA.mode);
        const b = parseCostToNumber(optionB.cost, optionB.mode);
        if (a == null || b == null) return "-";
        if (a === b) return "Same cost";

        const betterA = a < b;
        const diff = Math.abs(a - b);
        if ((side === "A" && betterA) || (side === "B" && !betterA)) {
            return `Saves ₹${diff} ▼`;
        }
        return `+₹${diff}`;
    });
}

function totalCo2Grams(option) {
    const perKm = Number(option?.co2PerKm);
    const dist = parseDistanceKm(option?.distance);
    if (!Number.isFinite(perKm) || !Number.isFinite(dist)) return null;
    return Math.round(perKm * dist);
}

function totalCo2(option) {
    return safeRender(() => {
        const total = totalCo2Grams(option);
        if (!Number.isFinite(total)) return "-";
        return `${total} g`;
    });
}

function co2Color(total) {
    if (!Number.isFinite(total)) return "rgba(255,255,255,.78)";
    if (total <= 120) return "#22c55e";
    if (total <= 280) return "#f59e0b";
    return "#ef4444";
}

function ProgressStat({ score, type }) {
    const safeScore = Number.isFinite(Number(score)) ? Number(score) : 0;
    const clamped = Math.max(0, Math.min(100, type === "safety" ? safeScore * 10 : safeScore));

    return (
        <div style={{ width: "100%" }}>
            <div style={{
                height: 6,
                background: "#333",
                width: "100%",
                borderRadius: 99,
                overflow: "hidden",
            }}>
                <div
                    style={{
                        width: `${clamped}%`,
                        height: "100%",
                        background: progressColor(type, safeScore),
                    }}
                />
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,.72)" }}>
                {type === "safety" ? `${safeScore}/10` : `${safeScore}%`}
            </div>
        </div>
    );
}

function ValueCell({ children, highlight = false }) {
    return (
        <div style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 12,
            color: highlight ? Y : "rgba(255,255,255,.78)",
            lineHeight: 1.5,
        }}>
            {children}
        </div>
    );
}

export default function ComparePanel({ optionA, optionB, onClose, weather }) {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== "undefined" ? window.innerWidth < 768 : false
    );

    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const bestPick = useMemo(() => bestPickMode(optionA, optionB), [optionA, optionB]);
    const winner = useMemo(() => pickWinner(optionA, optionB), [optionA, optionB]);

    const rowStyle = {
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 180px 1fr",
        gap: 10,
        padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,.07)",
        alignItems: "center",
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.92)",
                backdropFilter: "blur(8px)",
                zIndex: 1500,
                display: "flex",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "center",
                padding: isMobile ? 0 : 16,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: isMobile ? "100%" : "min(800px, 95vw)",
                    height: isMobile ? "100%" : "auto",
                    maxHeight: isMobile ? "100%" : "90vh",
                    background: BK,
                    border: `1px solid rgba(204,255,0,.25)`,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                }}
            >
                <div style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <div style={{
                        color: Y,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 11,
                        letterSpacing: 2,
                        fontWeight: 700,
                    }}>
                        COMPARE
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: WH,
                            cursor: "pointer",
                            fontSize: 18,
                            lineHeight: 1,
                        }}
                    >
                        X
                    </button>
                </div>

                <div style={{
                    flex: 1,
                    overflowY: "auto",
                    background: "#1A1A1A",
                }}>
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                        gap: 1,
                        background: "#1A1A1A",
                    }}>
                        {[{ opt: optionA, side: "A" }, { opt: optionB, side: "B" }].map(({ opt, side }) => (
                            <div key={side} style={{ background: BK }}>
                                <div style={{
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 2,
                                    background: BK,
                                    borderBottom: "1px solid rgba(255,255,255,.08)",
                                    padding: "12px 14px",
                                }}>
                                    <div style={{
                                        fontFamily: "'Bebas Neue',sans-serif",
                                        fontSize: 24,
                                        color: Y,
                                        letterSpacing: 1,
                                    }}>
                                        {modeName(opt?.mode)}
                                    </div>
                                    {bestPick === side && (
                                        <span style={{
                                            marginTop: 4,
                                            display: "inline-block",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            letterSpacing: 1.4,
                                            color: BK,
                                            background: Y,
                                            padding: "2px 8px",
                                        }}>
                                            BEST PICK
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ background: BK }}>
                        <div style={rowStyle}>
                            <ValueCell highlight>{compareDuration(optionA, optionB, "A")}</ValueCell>
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>DURATION</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ValueCell highlight>{compareDuration(optionA, optionB, "B")}</ValueCell>
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <ValueCell highlight>{compareCost(optionA, optionB, "A")}</ValueCell>
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>COST</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ValueCell highlight>{compareCost(optionA, optionB, "B")}</ValueCell>
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <ValueCell>
                                <span style={{ color: co2Color(totalCo2Grams(optionA)) }}>{safeRender(() => totalCo2(optionA))}</span>
                            </ValueCell>
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>CO2 EMISSIONS</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ValueCell>
                                    <span style={{ color: co2Color(totalCo2Grams(optionB)) }}>{safeRender(() => totalCo2(optionB))}</span>
                                </ValueCell>
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <ProgressStat score={safeRender(() => Number(optionA?.ecoScore))} type="eco" />
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>ECO SCORE</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ProgressStat score={safeRender(() => Number(optionB?.ecoScore))} type="eco" />
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <ProgressStat score={safeRender(() => Number(optionA?.safetyScore))} type="safety" />
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>SAFETY SCORE</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ProgressStat score={safeRender(() => Number(optionB?.safetyScore))} type="safety" />
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <ValueCell>{safeRender(() => aqiImpactLabel(optionA?.mode, weather))}</ValueCell>
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>AQI IMPACT</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ValueCell>{safeRender(() => aqiImpactLabel(optionB?.mode, weather))}</ValueCell>
                            </div>
                        </div>

                        <div style={rowStyle}>
                            <ValueCell>{safeRender(() => peakLabel(optionA?.mode))}</ValueCell>
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>PEAK HOUR</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ValueCell>{safeRender(() => peakLabel(optionB?.mode))}</ValueCell>
                            </div>
                        </div>

                        <div style={{ ...rowStyle, borderBottom: "none" }}>
                            <ValueCell>{safeRender(() => modeBestFor(optionA?.mode))}</ValueCell>
                            {!isMobile && <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, textAlign: "center" }}>BEST FOR</div>}
                            <div style={isMobile ? { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 8 } : undefined}>
                                <ValueCell>{safeRender(() => modeBestFor(optionB?.mode))}</ValueCell>
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{
                    textAlign: "center",
                    color: Y,
                    background: BK,
                    borderTop: "1px solid rgba(255,255,255,.08)",
                    padding: "10px 14px",
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: 1.2,
                    fontFamily: "'DM Sans',sans-serif",
                }}>
                    {`${modeName(winner?.mode)} WINS THIS COMPARISON`}
                </div>
            </div>
        </div>
    );
}
