import { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Y, BK, WH } from "../constants/theme";
import { isSpeechSupported, speakText, stopSpeech } from "../services/voiceService";

/* ─── Natural-language journey narrator ──────────────────────────
   Takes enriched transport options + weather context and builds
   a human-readable narration, then reveals it word-by-word.      */

// ── helpers ──────────────────────────────────────────────────────

function modeLabel(m) {
    const MAP = {
        train: "Train", metro: "Metro", bus: "Bus",
        cab: "Cab", auto: "Auto-rickshaw", walk: "Walking",
        transit: "Public Transit",
    };
    return MAP[m] || m;
}

function crowdAdj(c) {
    if (!c) return null;
    const MAP = { low: "uncrowded", moderate: "moderately crowded", high: "crowded", packed: "extremely packed" };
    return MAP[c] || c;
}

function safetyAdj(s) {
    if (s == null) return null;
    if (s >= 9) return "very safe";
    if (s >= 7) return "safe";
    if (s >= 5) return "moderately safe";
    return "relatively risky";
}

function ecoAdj(e) {
    if (e == null) return null;
    if (e >= 90) return "an excellent eco-friendly";
    if (e >= 70) return "a great green";
    if (e >= 40) return "a decent eco";
    if (e > 0) return "a fair environmental";
    return null;
}

function weatherLine(weather) {
    if (!weather) return "";
    const parts = [];
    if (weather.description) parts.push(weather.description);
    if (weather.temp != null) parts.push(`${Math.round(weather.temp)}\u00B0C`);
    if (weather.aqi != null) {
        const lvl = weather.aqi <= 50 ? "Good" : weather.aqi <= 100 ? "Moderate" : weather.aqi <= 150 ? "Unhealthy for sensitive groups" : weather.aqi <= 200 ? "Unhealthy" : "Poor";
        parts.push(`AQI ${weather.aqi} (${lvl})`);
    }
    if (parts.length === 0) return "";
    return `Current conditions: ${parts.join(", ")}. `;
}

// ── narration builder ────────────────────────────────────────────

export function buildNarration(options, weather) {
    if (!options || options.length === 0) return "No transport data available to explain.";

    const best = options.find(o => o.isBest) || options[0];
    const others = options.filter(o => o !== best);
    const lines = [];

    // Opening
    if (best.boarding && best.destination && best.boarding !== best.destination) {
        lines.push(`Here\u2019s what I\u2019d recommend for your journey from ${best.boarding} to ${best.destination}.`);
    } else {
        lines.push("Here\u2019s my analysis of the available transport options for your route.");
    }

    // Weather context
    const wl = weatherLine(weather);
    if (wl) lines.push(wl);

    // Best option narration
    const bParts = [];
    bParts.push(`${modeLabel(best.mode)} is your best bet`);
    if (best.duration) bParts.push(`with an estimated travel time of ${best.duration}`);
    if (best.cost) bParts.push(`costing around ${best.cost}`);
    lines.push(bParts.join(", ") + ".");

    // Safety
    const sa = safetyAdj(best.safetyScore);
    if (sa) {
        let safeLine = `Safety-wise, this route is rated ${sa} (${best.safetyScore}/10)`;
        if (best.safetyReasoning) safeLine += ` \u2014 ${best.safetyReasoning}`;
        lines.push(safeLine + ".");
    }

    // Crowd
    const ca = crowdAdj(best.crowdLevel);
    if (ca) lines.push(`Expect ${ca} conditions right now.`);

    // Eco
    const ea = ecoAdj(best.ecoScore);
    if (ea) {
        let ecoLine = `This is ${ea} choice`;
        if (best.ecoSavingsPercent > 0 && best.co2Grams != null) {
            ecoLine += ` \u2014 ${best.ecoSavingsPercent}% less CO\u2082 emissions compared to a cab`;
        }
        lines.push(ecoLine + ".");
    }

    // Peak warning
    if (best.peakWarning) lines.push(`Heads up: ${best.peakWarning}`);

    // Alternatives summary
    if (others.length > 0) {
        const altParts = others.slice(0, 3).map(o => {
            let p = modeLabel(o.mode);
            if (o.duration) p += ` (${o.duration}`;
            if (o.cost) p += `, ${o.cost}`;
            if (o.duration || o.cost) p += ")";
            return p;
        });
        lines.push(`Other options include ${altParts.join(", ")}.`);
    }

    // Why best
    if (best.whyBest) lines.push(best.whyBest);

    // Closing
    lines.push("Travel safe and enjoy your journey!");

    return lines.join(" ");
}

// ── animated narration panel ─────────────────────────────────────

const WORDS_PER_TICK = 2;
const TICK_MS = 45;

export default function JourneyExplainer({ options, weather }) {
    const [open, setOpen] = useState(false);
    const [visibleWords, setVisibleWords] = useState(0);
    const [narration, setNarration] = useState("");
    const [voiceEnabled, setVoiceEnabled] = useState(() => {
        if (typeof window === "undefined") return true;
        return localStorage.getItem("margdarshak_voice_enabled") !== "false";
    });
    const timerRef = useRef(null);
    const wordsRef = useRef([]);
    const spokenRef = useRef(false);

    const startNarration = useCallback(() => {
        if (open) { setOpen(false); return; }  // toggle off
        const text = buildNarration(options, weather);
        setNarration(text);
        wordsRef.current = text.split(/\s+/);
        setVisibleWords(0);
        setOpen(true);
    }, [open, options, weather]);

    useEffect(() => {
        if (!open) { clearInterval(timerRef.current); return; }
        const total = wordsRef.current.length;
        if (visibleWords >= total) return;

        timerRef.current = setInterval(() => {
            setVisibleWords(prev => {
                const next = prev + WORDS_PER_TICK;
                if (next >= total) { clearInterval(timerRef.current); return total; }
                return next;
            });
        }, TICK_MS);

        return () => clearInterval(timerRef.current);
    }, [open, visibleWords]);

    useEffect(() => {
        spokenRef.current = false;
    }, [narration]);

    useEffect(() => {
        if (!open || !narration) return;
        if (!voiceEnabled || !isSpeechSupported()) return;
        const totalWords = wordsRef.current.length;
        const doneNow = visibleWords >= totalWords && totalWords > 0;
        if (!doneNow || spokenRef.current) return;

        spokenRef.current = true;
        speakText(narration);
    }, [open, narration, visibleWords, voiceEnabled]);

    useEffect(() => {
        if (!open) stopSpeech();
    }, [open]);

    const toggleVoiceReadback = () => {
        setVoiceEnabled((prev) => {
            const next = !prev;
            if (typeof window !== "undefined") {
                localStorage.setItem("margdarshak_voice_enabled", String(next));
            }
            if (!next) stopSpeech();
            return next;
        });
    };

    const allWords = wordsRef.current;
    const displayText = allWords.slice(0, visibleWords).join(" ");
    const done = visibleWords >= allWords.length && allWords.length > 0;

    return (
        <div style={{ marginTop: 10 }}>
            {/* Button */}
            <button
                onClick={startNarration}
                data-hover
                style={{
                    width: "100%",
                    padding: "10px 16px",
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: 13,
                    letterSpacing: 2,
                    color: open ? BK : Y,
                    background: open ? Y : "transparent",
                    border: `1px solid ${Y}`,
                    cursor: "pointer",
                    transition: "all .2s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                }}
            >
                <span style={{ fontSize: 15 }}>{"\u25C8"}</span>
                {open ? "CLOSE EXPLANATION" : "EXPLAIN MY JOURNEY"}
            </button>

            {/* Narration panel */}
            {open && (
                <div
                    style={{
                        marginTop: 8,
                        padding: "16px 18px",
                        background: "rgba(204,255,0,.03)",
                        border: `1px solid rgba(204,255,0,.12)`,
                        borderLeft: `3px solid ${Y}`,
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Header */}
                    <div style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 12,
                        letterSpacing: 2.5,
                        color: Y,
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                        }}>
                            <span style={{
                                display: "inline-block",
                                width: 6, height: 6,
                                background: done ? Y : "#22c55e",
                                borderRadius: "50%",
                                animation: done ? "none" : "ldm-blink 1s infinite",
                            }} />
                            {done ? "AI NARRATION COMPLETE" : "AI IS NARRATING..."}
                        </div>
                        {isSpeechSupported() && (
                            <button
                                type="button"
                                onClick={toggleVoiceReadback}
                                aria-label="Toggle voice readback"
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    border: `1px solid ${Y}`,
                                    background: "transparent",
                                    color: voiceEnabled ? Y : WH,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                }}
                            >
                                {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                            </button>
                        )}
                    </div>

                    {/* Text */}
                    <div style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 13,
                        lineHeight: 1.75,
                        color: "rgba(255,255,255,.75)",
                    }}>
                        {displayText}
                        {!done && (
                            <span style={{
                                display: "inline-block",
                                width: 2,
                                height: 14,
                                background: Y,
                                marginLeft: 2,
                                verticalAlign: "text-bottom",
                                animation: "ldm-blink 0.6s step-end infinite",
                            }} />
                        )}
                    </div>

                    {/* Bottom bar — progress */}
                    <div style={{
                        position: "absolute",
                        bottom: 0, left: 0,
                        height: 2,
                        background: Y,
                        width: allWords.length > 0 ? `${(visibleWords / allWords.length) * 100}%` : "0%",
                        transition: "width 0.15s linear",
                    }} />
                </div>
            )}
        </div>
    );
}
