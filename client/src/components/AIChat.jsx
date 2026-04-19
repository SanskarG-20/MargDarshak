import { useState, useRef, useEffect, useCallback } from "react";
import { Mic } from "lucide-react";
import { Y, BK, WH } from "../constants/theme";
import { askMargDarshak } from "../services/aiService";
import { saveAIHistory, getAIHistory, saveTrip } from "../services/supabaseClient";
import { classifyIntent, buildIntentPrompt } from "../services/intentClassifier";
import { explainBestRoute } from "../services/explainRouteService";
import { calculateEcoScore } from "../services/ecoScoreService";
import WhyThisRoute from "./WhyThisRoute";
import SmartSuggestions from "./SmartSuggestions";
import JourneyExplainer from "./JourneyExplainer";
import ComparePanel from "./ComparePanel";
import TripTimeline from "./TripTimeline";

const SpeechRecognition =
    typeof window !== "undefined"
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null;

const recognition = SpeechRecognition
    ? new SpeechRecognition()
    : null;

if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
}

function normalizeMode(mode) {
    if (!mode) return null;
    const value = String(mode).toLowerCase().trim();
    if (value === "bus") return "transit";
    if (value === "bus / transit") return "transit";
    return value;
}

function parseCostValue(text, mode = "") {
    const modeKey = String(mode).toLowerCase();
    if (modeKey === "walk") return 0;
    if (!text) return null;
    const raw = String(text).toLowerCase();
    if (raw.includes("free")) return 0;

    const allNumbers = raw.match(/[\d,]+/g);
    if (!allNumbers || allNumbers.length === 0) return null;

    const parsed = allNumbers
        .map((n) => Number(n.replace(/,/g, "")))
        .filter((n) => Number.isFinite(n));
    if (parsed.length === 0) return null;

    if (parsed.length === 1) return parsed[0];
    const total = parsed.reduce((sum, n) => sum + n, 0);
    return Math.round(total / parsed.length);
}

function inferDetectedMode(result) {
    if (!result?.transportOptions?.length) return null;
    const best = result.transportOptions.find((o) => o.isBest) || result.transportOptions[0];
    return normalizeMode(best?.mode);
}

function inferEstimatedCost(result) {
    if (result?.transportOptions?.length) {
        const best = result.transportOptions.find((o) => o.isBest) || result.transportOptions[0];
        const fromRoute = parseCostValue(best?.cost, best?.mode);
        if (fromRoute != null) return fromRoute;
    }
    return parseCostValue(result?.estimatedBudget);
}

export default function AIChat({
    dbUser,
    onAIResponse,
    userLocation,
    weatherContext,
    weather,
    pendingQuery,
    usePreferences = false,
    preferences = null,
    safeMode = false,
    onBehaviorTracked,
}) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const chatEndRef = useRef(null);
    const lastPendingRef = useRef(null);

    // Load previous chat history from Supabase on mount
    useEffect(() => {
        if (!dbUser?.id || historyLoaded) return;

        setHistoryLoaded(true);
        getAIHistory(dbUser.id, 20).then((history) => {
            if (history.length > 0) {
                const restored = [];
                history.forEach((h) => {
                    restored.push({ role: "user", content: h.prompt });
                    let parsed = null;
                    try {
                        parsed = JSON.parse(h.response);
                    } catch {
                        parsed = { summary: h.response, places: [], tips: [] };
                    }
                    restored.push({
                        role: "assistant",
                        content: h.response,
                        parsed,
                    });
                });
                setMessages(restored);
                // If we have past successful AI responses, mark AI as active
                onAIResponse?.();
            }
        });
    }, [dbUser?.id, historyLoaded, onAIResponse]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-send when pendingQuery changes (saved route clicked)
    useEffect(() => {
        if (!pendingQuery || loading) return;
        const key = pendingQuery.ts || pendingQuery;
        if (key === lastPendingRef.current) return;
        lastPendingRef.current = key;
        sendQuery(pendingQuery.text || pendingQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingQuery]);

    function startVoice() {
        if (!recognition) return;

        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;

        recognition.onresult = (event) => {
            const idx = event.resultIndex ?? 0;
            const result = event.results?.[idx] || event.results?.[0];
            const transcript = result?.[0]?.transcript?.trim() || "";
            if (!transcript) {
                setIsListening(false);
                return;
            }
            setInput(transcript);
            setIsListening(false);
        };

        recognition.onerror = (event) => {
            console.error("Speech error:", event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        try {
            recognition.start();
            setIsListening(true);
        } catch {
            console.warn("Recognition already active");
        }
    }

    const sendQuery = async (queryText) => {
        const userMsg = queryText.trim();
        if (!userMsg) return;

        const intents = classifyIntent(userMsg);
        const primaryIntent = intents.length > 0 && intents[0].confidence >= 0.2 ? intents[0] : null;
        const intentPrompt = buildIntentPrompt(userMsg);

        setMessages((prev) => [
            ...prev,
            { role: "user", content: userMsg, detectedIntent: primaryIntent },
        ]);
        setLoading(true);

        const activePreferences = usePreferences ? preferences : null;
        const result = await askMargDarshak(userMsg, messages, userLocation, weatherContext, intentPrompt, activePreferences, safeMode);
        const aiContent = result.error
            ? result.summary
            : JSON.stringify(result);

        setMessages((prev) => [
            ...prev,
            { role: "assistant", content: aiContent, parsed: result },
        ]);
        setLoading(false);

        if (!result.error) {
            onAIResponse?.(result);
        }

        if (dbUser?.id && !result.error) {
            const detectedMode = inferDetectedMode(result);
            const estimatedCost = inferEstimatedCost(result);
            saveAIHistory({
                userId: dbUser.id,
                prompt: userMsg,
                response: aiContent,
                detectedMode,
                estimatedCost,
                travelHour: new Date().getHours(),
            });
            onBehaviorTracked?.();
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");

        // Classify intent from the user message
        const intents = classifyIntent(userMsg);
        const primaryIntent = intents.length > 0 && intents[0].confidence >= 0.2 ? intents[0] : null;
        const intentPrompt = buildIntentPrompt(userMsg);

        setMessages((prev) => [
            ...prev,
            { role: "user", content: userMsg, detectedIntent: primaryIntent },
        ]);
        setLoading(true);

        const activePreferences = usePreferences ? preferences : null;
        const result = await askMargDarshak(userMsg, messages, userLocation, weatherContext, intentPrompt, activePreferences, safeMode);
        const aiContent = result.error
            ? result.summary
            : JSON.stringify(result);

        setMessages((prev) => [
            ...prev,
            { role: "assistant", content: aiContent, parsed: result },
        ]);
        setLoading(false);

        if (!result.error) {
            onAIResponse?.(result);
        }

        if (dbUser?.id && !result.error) {
            const detectedMode = inferDetectedMode(result);
            const estimatedCost = inferEstimatedCost(result);
            saveAIHistory({
                userId: dbUser.id,
                prompt: userMsg,
                response: aiContent,
                detectedMode,
                estimatedCost,
                travelHour: new Date().getHours(),
            });
            onBehaviorTracked?.();
        }
    };

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
                        background: loading ? Y : "#22c55e",
                        display: "inline-block",
                        boxShadow: loading ? `0 0 8px ${Y}` : "0 0 8px #22c55e",
                        animation: loading
                            ? "pulse-ring 1s ease infinite"
                            : "pulse-ring 2s ease infinite",
                    }}
                />
                AI TRAVEL ASSISTANT
            </div>

            {/* Chat messages */}
            <div
                style={{
                    maxHeight: 600,
                    overflowY: "auto",
                    marginBottom: 16,
                    border: "1px solid rgba(255,255,255,.08)",
                    background: "rgba(255,255,255,.02)",
                }}
            >
                {messages.length === 0 && (
                    <div
                        style={{
                            padding: "40px 24px",
                            textAlign: "center",
                            fontFamily: "'DM Sans',sans-serif",
                            color: "rgba(255,255,255,.25)",
                            fontSize: 14,
                        }}
                    >
                        Ask MargDarshak AI about any travel plan in India
                        <br />
                        <span style={{ fontSize: 12, opacity: 0.6 }}>
                            Try: "I'm in Jaipur with ₹2000 budget, suggest a full day plan"
                        </span>
                        <div style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 6,
                            marginTop: 12,
                            flexWrap: "wrap",
                        }}>
                            {[
                                { label: "Sightseeing", color: "#60a5fa" },
                                { label: "Food", color: "#f97316" },
                                { label: "Budget", color: "#22c55e" },
                                { label: "Safety", color: "#ef4444" },
                                { label: "Quick Trip", color: "#a78bfa" },
                                { label: "Route", color: "#06b6d4" },
                            ].map((t) => (
                                <span
                                    key={t.label}
                                    style={{
                                        fontSize: 9,
                                        fontWeight: 600,
                                        letterSpacing: 1,
                                        textTransform: "uppercase",
                                        padding: "2px 8px",
                                        color: t.color,
                                        background: t.color + "12",
                                        border: `1px solid ${t.color}25`,
                                    }}
                                >
                                    {t.label}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i}>
                        {msg.role === "user" ? (
                            <div
                                style={{
                                    padding: "14px 20px",
                                    borderLeft: `3px solid ${Y}`,
                                    background: "rgba(204,255,0,.03)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 6,
                                    }}
                                >
                                    <div
                                        style={{
                                            fontFamily: "'DM Sans',sans-serif",
                                            fontSize: 11,
                                            color: Y,
                                            letterSpacing: 2,
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        YOU
                                    </div>
                                    {msg.detectedIntent && (
                                        <IntentBadge intent={msg.detectedIntent} />
                                    )}
                                </div>
                                <div
                                    style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 14,
                                        color: "rgba(255,255,255,.8)",
                                    }}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ) : (
                            <AIResponse
                                msg={msg}
                                weather={weather}
                                dbUser={dbUser}
                                usePreferences={usePreferences}
                                preferences={preferences}
                                onBehaviorTracked={onBehaviorTracked}
                            />
                        )}
                    </div>
                ))}

                {loading && (
                    <LiveDecisionSteps />
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about any Indian city, route, or travel plan..."
                    disabled={loading}
                    style={{
                        flex: 1,
                        padding: "14px 18px",
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 15,
                        color: WH,
                        background: "rgba(255,255,255,.05)",
                        border: "2px solid rgba(255,255,255,.15)",
                        outline: "none",
                        transition: "border-color .2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = Y)}
                    onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,.15)")
                    }
                />
                <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    data-hover
                    style={{
                        padding: "14px 18px",
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 15,
                        letterSpacing: 1.5,
                        color: BK,
                        background: loading ? "rgba(204,255,0,.5)" : Y,
                        border: `2px solid ${Y}`,
                        cursor: loading ? "wait" : "pointer",
                        transition: "all .15s",
                        whiteSpace: "nowrap",
                    }}
                >
                    {loading ? "..." : "ASK AI →"}
                </button>
                {recognition && (
                    <button
                        type="button"
                        onClick={isListening
                            ? () => {
                                recognition.stop();
                                setIsListening(false);
                            }
                            : startVoice}
                        aria-label="Voice input"
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            border: isListening
                                ? "2px solid #FF3B3B"
                                : "1.5px solid #CCFF00",
                            background: isListening
                                ? "rgba(255,59,59,0.15)"
                                : "transparent",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "all 0.2s ease",
                        }}
                    >
                        {isListening ? (
                            <div
                                style={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    background: "#FF3B3B",
                                    animation: "pulse-red 1s infinite",
                                }}
                            />
                        ) : (
                            <Mic size={16} color="#CCFF00" />
                        )}
                    </button>
                )}
            </form>
        </div>
    );
}

function AIResponse({ msg, weather, dbUser, usePreferences = false, preferences = null, onBehaviorTracked }) {
    const data = msg.parsed;

    if (!data || data.error) {
        return (
            <div
                style={{
                    padding: "14px 20px",
                    borderLeft: "3px solid #ef4444",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 14,
                    color: "rgba(255,255,255,.6)",
                }}
            >
                {data?.summary || msg.content}
            </div>
        );
    }

    return (
        <div
            style={{
                padding: "16px 20px",
                borderLeft: "3px solid rgba(255,255,255,.1)",
                background: "rgba(255,255,255,.01)",
            }}
        >
            {/* Detected intent label */}
            {data.detectedIntent && data.detectedIntent !== "general" && (
                <div
                    style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        marginBottom: 12,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: BK,
                        background: Y,
                    }}
                >
                    {data.detectedIntent.replace("_", " ")} MODE
                </div>
            )}

            {/* Summary */}
            {data.summary && (
                <div
                    style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 14,
                        color: "rgba(255,255,255,.7)",
                        marginBottom: 16,
                        lineHeight: 1.6,
                    }}
                >
                    {data.summary}
                </div>
            )}

            <TripTimeline itinerary={data.itinerary} />

            {/* Places */}
            {data.places?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <div
                        style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 14,
                            color: Y,
                            letterSpacing: 2,
                            marginBottom: 8,
                        }}
                    >
                        SUGGESTED PLACES
                    </div>
                    {data.places.map((place, i) => (
                        <div
                            key={i}
                            style={{
                                padding: "10px 14px",
                                marginBottom: 6,
                                background: "rgba(204,255,0,.03)",
                                border: "1px solid rgba(255,255,255,.06)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                gap: 12,
                            }}
                        >
                            <div>
                                <div
                                    style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: "rgba(255,255,255,.85)",
                                        marginBottom: 2,
                                    }}
                                >
                                    {place.name}
                                </div>
                                <div
                                    style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 12,
                                        color: "rgba(255,255,255,.45)",
                                    }}
                                >
                                    {place.description}
                                </div>
                            </div>
                            {place.estimatedCost && (
                                <span
                                    style={{
                                        fontFamily: "'Bebas Neue',sans-serif",
                                        fontSize: 13,
                                        color: Y,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {place.estimatedCost}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Budget + Time */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                {data.estimatedBudget && (
                    <div
                        style={{
                            padding: "8px 14px",
                            border: `1px solid ${Y}`,
                            background: "rgba(204,255,0,.05)",
                        }}
                    >
                        <span
                            style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 11,
                                color: "rgba(255,255,255,.4)",
                                letterSpacing: 1,
                            }}
                        >
                            BUDGET{" "}
                        </span>
                        <span
                            style={{
                                fontFamily: "'Bebas Neue',sans-serif",
                                fontSize: 16,
                                color: Y,
                            }}
                        >
                            {data.estimatedBudget}
                        </span>
                    </div>
                )}
                {data.bestTime && (
                    <div
                        style={{
                            padding: "8px 14px",
                            border: "1px solid rgba(255,255,255,.15)",
                        }}
                    >
                        <span
                            style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 11,
                                color: "rgba(255,255,255,.4)",
                                letterSpacing: 1,
                            }}
                        >
                            BEST TIME{" "}
                        </span>
                        <span
                            style={{
                                fontFamily: "'Bebas Neue',sans-serif",
                                fontSize: 16,
                                color: WH,
                            }}
                        >
                            {data.bestTime}
                        </span>
                    </div>
                )}
            </div>

            {/* Tips */}
            {data.tips?.length > 0 && (
                <div>
                    <div
                        style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 14,
                            color: "rgba(255,255,255,.4)",
                            letterSpacing: 2,
                            marginBottom: 6,
                        }}
                    >
                        LOCAL TIPS
                    </div>
                    {data.tips.map((tip, i) => (
                        <div
                            key={i}
                            style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 13,
                                color: "rgba(255,255,255,.5)",
                                paddingLeft: 14,
                                marginBottom: 4,
                                borderLeft: "2px solid rgba(255,255,255,.08)",
                            }}
                        >
                            {tip}
                        </div>
                    ))}
                </div>
            )}

            {/* Transport Options */}
            {data.transportOptions?.length > 0 && (
                <TransportReveal
                    options={data.transportOptions}
                    weather={weather}
                    dbUser={dbUser}
                    usePreferences={usePreferences}
                    preferences={preferences}
                    onBehaviorTracked={onBehaviorTracked}
                />
            )}

            {/* Smart Suggestions — after route analysis */}
            {data.transportOptions?.length > 0 && data.smartSuggestions && (
                <SmartSuggestions suggestions={data.smartSuggestions} />
            )}
        </div>
    );
}

/* ── Live Decision Mode ───────────────────────── */

const DECISION_STEPS = [
    { text: "Analyzing travel query...", icon: "◈", duration: 600 },
    { text: "Scanning transport networks...", icon: "◇", duration: 800 },
    { text: "Evaluating train / metro schedules...", icon: "▣", duration: 700 },
    { text: "Comparing bus routes...", icon: "▤", duration: 600 },
    { text: "Estimating cab / auto fares...", icon: "▥", duration: 500 },
    { text: "Checking peak hour conditions...", icon: "◉", duration: 600 },
    { text: "Ranking options by cost + time...", icon: "◆", duration: 700 },
    { text: "Selecting best recommendation...", icon: "✦", duration: 500 },
];

function LiveDecisionSteps() {
    const [visibleSteps, setVisibleSteps] = useState(0);
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        let step = 0;
        const timers = [];

        const showNext = () => {
            if (step >= DECISION_STEPS.length) return;
            setVisibleSteps(step + 1);
            setActiveStep(step);
            step++;
            timers.push(setTimeout(showNext, DECISION_STEPS[Math.min(step, DECISION_STEPS.length - 1)]?.duration || 600));
        };

        // Start after a brief pause
        timers.push(setTimeout(showNext, 200));

        return () => timers.forEach(clearTimeout);
    }, []);

    return (
        <div
            style={{
                padding: "16px 20px",
                borderLeft: `3px solid ${Y}`,
                background: "rgba(204,255,0,.02)",
            }}
        >
            {/* Header */}
            <div style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 12,
                color: Y,
                letterSpacing: 3,
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
            }}>
                <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: Y,
                    boxShadow: `0 0 8px ${Y}`,
                    animation: "ldm-cursor-blink 0.8s ease infinite",
                    display: "inline-block",
                }} />
                LIVE DECISION MODE
            </div>

            {/* Progress bar */}
            <div style={{
                height: 2,
                background: "rgba(255,255,255,.06)",
                marginBottom: 12,
                overflow: "hidden",
            }}>
                <div style={{
                    height: "100%",
                    background: `linear-gradient(90deg, ${Y}, rgba(204,255,0,.3))`,
                    width: `${(visibleSteps / DECISION_STEPS.length) * 100}%`,
                    transition: "width 0.4s ease-out",
                }} />
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {DECISION_STEPS.slice(0, visibleSteps).map((s, i) => {
                    const isActive = i === activeStep && visibleSteps < DECISION_STEPS.length;
                    const isDone = i < activeStep || visibleSteps >= DECISION_STEPS.length;
                    return (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                animation: "ldm-step-in 0.3s ease both",
                            }}
                        >
                            {/* Step icon */}
                            <span style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 10,
                                width: 16,
                                textAlign: "center",
                                color: isDone ? "#22c55e" : isActive ? Y : "rgba(255,255,255,.3)",
                                animation: isDone ? "ldm-check-pop 0.3s ease both" : "none",
                            }}>
                                {isDone ? "✓" : s.icon}
                            </span>

                            {/* Step text */}
                            <span style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 12,
                                color: isDone
                                    ? "rgba(255,255,255,.3)"
                                    : isActive
                                    ? "rgba(255,255,255,.8)"
                                    : "rgba(255,255,255,.5)",
                                transition: "color 0.3s",
                            }}>
                                {s.text}
                            </span>

                            {/* Blinking cursor on active step */}
                            {isActive && (
                                <span style={{
                                    display: "inline-block",
                                    width: 6, height: 12,
                                    background: Y,
                                    animation: "ldm-cursor-blink 0.6s step-end infinite",
                                    marginLeft: -4,
                                }} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── Transport Reveal (staggered + glow) ──────── */

/** Parse AI duration string ("25 min" / "1h 30m" / "2h") → km estimate using mode avg speed */
const MODE_SPEED_KMPH = { walk: 5, metro: 35, train: 40, bus: 20, transit: 20, cab: 25, auto: 20 };
function estimateDistanceFromDuration(durationStr, mode) {
    if (!durationStr) return null;
    let mins = 0;
    const h = durationStr.match(/(\d+)\s*h/);
    const m = durationStr.match(/(\d+)\s*m/);
    if (h) mins += parseInt(h[1]) * 60;
    if (m) mins += parseInt(m[1]);
    if (!h && !m) {
        const plain = parseInt(durationStr);
        if (!isNaN(plain)) mins = plain;
    }
    if (mins <= 0) return null;
    const speed = MODE_SPEED_KMPH[mode] || 25;
    return (mins / 60) * speed;
}

/** Attach eco scores to AI-returned transport options (mutates in-place) */
function enrichWithEco(options) {
    return options.map(function(opt) {
        if (opt.ecoScore != null) return opt;         // already has eco data
        const dist = estimateDistanceFromDuration(opt.duration, opt.mode);
        if (!dist) return opt;
        const eco = calculateEcoScore(opt.mode, dist);
        return { ...opt, co2Grams: eco.co2Grams, ecoScore: eco.ecoScore, ecoSavingsPercent: eco.savingsPercent, ecoLabel: eco.ecoLabel };
    });
}

function TransportReveal({ options, weather, dbUser, usePreferences = false, preferences = null, onBehaviorTracked }) {
    const [revealCount, setRevealCount] = useState(0);
    const [glowBest, setGlowBest] = useState(false);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showComparePanel, setShowComparePanel] = useState(false);
    const [comparePair, setComparePair] = useState([]);

    // Enrich AI options with eco scores estimated from duration
    const enrichedOptions = enrichWithEco(options);

    // Reset saved state when the matching trip is deleted from SavedRoutes
    useEffect(() => {
        const handler = (e) => {
            const { source, destination } = e.detail || {};
            // Find route info to compare
            const routeOpt = enrichedOptions.find(
                (o) => o.boarding && o.destination && o.boarding !== o.destination
            ) || enrichedOptions.find((o) => o.isBest);
            const mySource = routeOpt?.boarding || "";
            const myDest = routeOpt?.destination || "";
            if (
                source && destination &&
                source.toLowerCase() === mySource.toLowerCase() &&
                destination.toLowerCase() === myDest.toLowerCase()
            ) {
                setSaved(false);
            }
        };
        window.addEventListener("savedtrips:deleted", handler);
        return () => window.removeEventListener("savedtrips:deleted", handler);
    }, [enrichedOptions]);

    useEffect(() => {
        let count = 0;
        const total = enrichedOptions.length;
        const timers = [];
        setRevealCount(0);
        setGlowBest(false);

        const revealNext = () => {
            count++;
            setRevealCount(count);
            if (count < total) {
                timers.push(setTimeout(revealNext, 250));
            } else {
                // After all cards revealed, trigger glow on best
                timers.push(setTimeout(() => setGlowBest(true), 400));
            }
        };

        timers.push(setTimeout(revealNext, 150));

        return () => timers.forEach(clearTimeout);
    }, [enrichedOptions.length]);

    const parseCost = (text, mode) => {
        if ((mode || "").toLowerCase() === "walk") return 0;
        if (!text) return Number.MAX_SAFE_INTEGER;
        const raw = String(text).toLowerCase();
        if (raw.includes("free")) return 0;
        const digits = raw.replace(/[^\d]/g, "");
        return digits ? parseInt(digits, 10) : Number.MAX_SAFE_INTEGER;
    };

    const parseDuration = (text) => {
        if (!text) return Number.MAX_SAFE_INTEGER;
        const raw = String(text).toLowerCase();
        const hr = raw.match(/(\d+)\s*h(?:r|our)?/);
        const mn = raw.match(/(\d+)\s*m(?:in|ins|inute|inutes)?/);
        if (!hr && !mn) {
            const n = raw.match(/\d+/);
            return n ? parseInt(n[0], 10) : Number.MAX_SAFE_INTEGER;
        }
        return (hr ? parseInt(hr[1], 10) * 60 : 0) + (mn ? parseInt(mn[1], 10) : 0);
    };

    const handleCompareTop2 = () => {
        if (enrichedOptions.length < 2) return;
        const sorted = [...enrichedOptions].sort((a, b) => {
            const ac = parseCost(a.cost, a.mode);
            const bc = parseCost(b.cost, b.mode);
            if (ac !== bc) return ac - bc;
            return parseDuration(a.duration) - parseDuration(b.duration);
        });
        setComparePair([sorted[0], sorted[1]]);
        setShowComparePanel(true);
    };

    return (
        <div style={{ marginTop: 16 }}>
            <div
                style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: 14,
                    color: Y,
                    letterSpacing: 2,
                    marginBottom: 10,
                }}
            >
                TRANSPORT ANALYSIS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {enrichedOptions.map((opt, i) => {
                    if (i >= revealCount) return null;
                    const isGlowing = glowBest && opt.isBest;
                    return (
                        <div
                            key={i}
                            style={{
                                animation: `ldm-card-in 0.35s ease both`,
                                ...(isGlowing ? {
                                    animation: `ldm-card-in 0.35s ease both, ldm-best-glow 1.5s ease forwards`,
                                } : {}),
                            }}
                        >
                            <TransportCard opt={opt} glowing={isGlowing} />
                        </div>
                    );
                })}
            </div>

            {glowBest && enrichedOptions.length >= 2 && (
                <div style={{ marginTop: 10 }}>
                    <button
                        type="button"
                        onClick={handleCompareTop2}
                        style={{
                            border: "1px solid rgba(204,255,0,.3)",
                            color: "rgba(204,255,0,.7)",
                            background: "transparent",
                            borderRadius: 50,
                            padding: "8px 18px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        ◈ COMPARE TOP 2 ROUTES
                    </button>
                </div>
            )}

            {/* Decision summary + WhyThisRoute + Save Route after all revealed */}
            {glowBest && (() => {
                const best = enrichedOptions.find((o) => o.isBest);
                if (!best) return null;
                const activePreferences = usePreferences ? preferences : null;
                const explanation = explainBestRoute(best, enrichedOptions, weather, activePreferences);

                // Extract source/destination from the best option or first option with route info
                const routeOpt = enrichedOptions.find((o) => o.boarding && o.destination && o.boarding !== o.destination) || best;
                const source = routeOpt.boarding || "";
                const dest = routeOpt.destination || "";

                const handleSaveRoute = async () => {
                    if (!dbUser?.id || !source || !dest || saved || saving) return;
                    setSaving(true);
                    const result = await saveTrip({
                        userId: dbUser.id,
                        source,
                        destination: dest,
                        preferredMode: best.mode || null,
                        estimatedCost: parseCostValue(best.cost, best.mode),
                        travelHour: new Date().getHours(),
                    });
                    setSaving(false);
                    if (result) {
                        setSaved(true);
                        window.dispatchEvent(new Event("savedtrips:refresh"));
                        onBehaviorTracked?.();
                    }
                };

                return (
                    <>
                        <div style={{
                            marginTop: 10,
                            padding: "8px 14px",
                            background: "rgba(204,255,0,.04)",
                            borderLeft: `3px solid ${Y}`,
                            animation: "ldm-step-in 0.4s ease both",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 8,
                        }}>
                            <div>
                                <span style={{
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 11,
                                    letterSpacing: 2,
                                    color: Y,
                                }}>
                                    AI RECOMMENDATION
                                </span>
                                <span style={{
                                    fontFamily: "'DM Sans',sans-serif",
                                    fontSize: 12,
                                    color: "rgba(255,255,255,.6)",
                                    marginLeft: 8,
                                }}>
                                    {best.whyBest || `${best.label || best.mode} is the best option`}
                                </span>
                            </div>
                            {source && dest && dbUser?.id && (
                                <button
                                    onClick={handleSaveRoute}
                                    disabled={saved || saving}
                                    data-hover
                                    style={{
                                        padding: "4px 12px",
                                        fontFamily: "'Bebas Neue',sans-serif",
                                        fontSize: 11,
                                        letterSpacing: 1.5,
                                        color: saved ? BK : Y,
                                        background: saved ? Y : "transparent",
                                        border: `1px solid ${Y}`,
                                        cursor: saved ? "default" : "pointer",
                                        transition: "all .15s",
                                        whiteSpace: "nowrap",
                                        flexShrink: 0,
                                    }}
                                >
                                    {saving ? "..." : saved ? "\u2713 SAVED" : "\u2606 SAVE ROUTE"}
                                </button>
                            )}
                        </div>
                        <WhyThisRoute reasons={explanation.reasons} />
                        <JourneyExplainer options={enrichedOptions} weather={weather} />
                    </>
                );
            })()}

            {showComparePanel && comparePair.length === 2 && (
                <ComparePanel
                    optionA={comparePair[0]}
                    optionB={comparePair[1]}
                    weather={weather}
                    onClose={() => setShowComparePanel(false)}
                />
            )}
        </div>
    );
}

/* ── Intent Badge ────────────────────────────── */

const INTENT_COLORS = {
    sightseeing: "#60a5fa",
    food: "#f97316",
    budget: "#22c55e",
    safety: "#ef4444",
    quick_trip: "#a78bfa",
    route: "#06b6d4",
};

const INTENT_ICONS = {
    sightseeing: "◈",
    food: "◇",
    budget: "▣",
    safety: "◉",
    quick_trip: "▸",
    route: "◆",
};

function IntentBadge({ intent }) {
    const color = INTENT_COLORS[intent.type] || Y;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: color,
                background: color + "15",
                border: `1px solid ${color}30`,
                borderRadius: 2,
            }}
        >
            {INTENT_ICONS[intent.type] || ""} {intent.label}
        </span>
    );
}

/* -- Transport mode icons (inline SVG) -- */
const TRANSPORT_MODE_ICON = {
    train: (c) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="14" rx="2" />
            <path d="M4 10h16" /><path d="M9 21l-2-4" /><path d="M15 21l2-4" />
            <circle cx="9" cy="14" r="1" fill={c} /><circle cx="15" cy="14" r="1" fill={c} />
        </svg>
    ),
    bus: (c) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="14" rx="2" />
            <path d="M3 9h18" /><path d="M7 20l-1 1" /><path d="M17 20l1 1" />
            <path d="M7 20h10" />
        </svg>
    ),
    cab: (c) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3v-3l2.5-6h11L19 14v3h-2" />
            <circle cx="7.5" cy="17.5" r="1.5" /><circle cx="16.5" cy="17.5" r="1.5" />
            <path d="M5 11h14" />
        </svg>
    ),
    walk: (c) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="4" r="2" fill={c} stroke="none" />
            <path d="M9 12l1.5-4.5L14 9l2 4" /><path d="M7 20l3-4 2 1 1 3" /><path d="M15 20l-1-5" />
        </svg>
    ),
    metro: (c) => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" />
            <path d="M12 2v20" /><path d="M4 7l8 5 8-5" />
            <circle cx="12" cy="12" r="2.5" fill={c} stroke="none" />
        </svg>
    ),
};

const CROWD_COLORS = {
    low: "#22c55e",
    moderate: "#eab308",
    high: "#f97316",
    packed: "#ef4444",
};

function TransportCard({ opt, glowing }) {
    const isBest = opt.isBest;
    const modeColor = isBest ? Y : "rgba(255,255,255,.6)";
    const IconFn = TRANSPORT_MODE_ICON[opt.mode] || TRANSPORT_MODE_ICON.cab;

    return (
        <div
            style={{
                padding: "14px 16px",
                border: `1px solid ${isBest ? Y : "rgba(255,255,255,.08)"}`,
                background: isBest ? "rgba(204,255,0,.05)" : "rgba(255,255,255,.02)",
                position: "relative",
                transition: "box-shadow 0.6s ease",
                ...(glowing ? {
                    boxShadow: `0 0 16px 3px rgba(204,255,0,.12), inset 0 0 20px rgba(204,255,0,.03)`,
                } : {}),
            }}
        >
            {/* Best badge */}
            {isBest && (
                <div style={{
                    position: "absolute", top: -1, right: 12,
                    background: Y, color: BK,
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: 9, letterSpacing: 2,
                    padding: "2px 8px",
                }}>
                    BEST
                </div>
            )}

            {/* Mode header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                    width: 30, height: 30, borderRadius: 4,
                    background: isBest ? Y : "rgba(255,255,255,.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                }}>
                    {IconFn(isBest ? BK : "rgba(255,255,255,.5)")}
                </div>
                <div style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 14, fontWeight: 600,
                    color: isBest ? WH : "rgba(255,255,255,.7)",
                }}>
                    {opt.label || opt.mode}
                </div>
            </div>

            {/* Route info — only show if boarding and destination are different */}
            {(opt.boarding || opt.destination) && opt.boarding !== opt.destination && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                    {opt.boarding && (
                        <span style={{
                            fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                            color: "rgba(255,255,255,.55)",
                            padding: "2px 8px",
                            background: "rgba(255,255,255,.04)",
                            border: "1px solid rgba(255,255,255,.08)",
                        }}>
                            {opt.boarding}
                        </span>
                    )}
                    {opt.boarding && opt.destination && (
                        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 11, color: Y, letterSpacing: 1 }}>→</span>
                    )}
                    {opt.destination && (
                        <span style={{
                            fontFamily: "'DM Sans',sans-serif", fontSize: 12,
                            color: "rgba(255,255,255,.55)",
                            padding: "2px 8px",
                            background: "rgba(255,255,255,.04)",
                            border: "1px solid rgba(255,255,255,.08)",
                        }}>
                            {opt.destination}
                        </span>
                    )}
                </div>
            )}

            {/* Stats row */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: opt.peakWarning || opt.whyBest ? 8 : 0 }}>
                {opt.duration && (
                    <TransportStat label="ETA" value={opt.duration} highlight={isBest} />
                )}
                {opt.cost && (
                    <TransportStat label="COST" value={opt.cost} color={opt.cost === "Free" || opt.cost === "₹0" ? "#22c55e" : null} highlight={isBest} />
                )}
                {opt.frequency && (
                    <TransportStat label="FREQ" value={opt.frequency} />
                )}
                {opt.crowdBadge && (
                    <TransportStat label="CROWD" value={opt.crowdBadge} color={CROWD_COLORS[opt.crowdLevel] || null} />
                )}
                {!opt.crowdBadge && opt.crowdLevel && (
                    <TransportStat label="CROWD" value={opt.crowdLevel.toUpperCase()} color={CROWD_COLORS[opt.crowdLevel] || null} />
                )}
                {opt.details && (
                    <TransportStat label="TYPE" value={opt.details} />
                )}
                {opt.safetyScore != null && (
                    <TransportStat
                        label={"\u25C9 SAFETY"}
                        value={opt.safetyScore + "/10"}
                        color={
                            opt.safetyScore >= 8 ? "#22c55e" :
                            opt.safetyScore >= 5 ? "#eab308" :
                            "#ef4444"
                        }
                    />
                )}
                {opt.ecoScore != null && (
                    <TransportStat
                        label={"\u25C7 ECO"}
                        value={opt.ecoScore + "%"}
                        color={
                            opt.ecoScore >= 80 ? "#22c55e" :
                            opt.ecoScore >= 50 ? "#06b6d4" :
                            opt.ecoScore > 0  ? "#eab308" :
                            "rgba(255,255,255,.3)"
                        }
                    />
                )}
            </div>

            {/* Eco savings */}
            {opt.ecoSavingsPercent > 0 && opt.co2Grams != null && (
                <div style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11,
                    color: opt.ecoScore >= 80 ? "#22c55e" : "#06b6d4",
                    padding: "4px 8px",
                    background: opt.ecoScore >= 80
                        ? "rgba(34,197,94,.06)"
                        : "rgba(6,182,212,.06)",
                    border: opt.ecoScore >= 80
                        ? "1px solid rgba(34,197,94,.12)"
                        : "1px solid rgba(6,182,212,.12)",
                    marginBottom: opt.peakWarning || opt.safetyReasoning || opt.whyBest ? 6 : 0,
                }}>
                    {"\u25C7"} {opt.ecoSavingsPercent}% less CO{"\u2082"} vs cab ({opt.co2Grams}g vs {Math.round(opt.co2Grams / (1 - opt.ecoSavingsPercent / 100))}g)
                </div>
            )}

            {/* Peak warning */}
            {opt.peakWarning && (
                <div style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11, color: "#f97316",
                    padding: "4px 8px",
                    background: "rgba(249,115,22,.06)",
                    border: "1px solid rgba(249,115,22,.12)",
                    marginBottom: opt.whyBest || opt.safetyReasoning ? 6 : 0,
                }}>
                    {"\u25B2"} {opt.peakWarning}
                </div>
            )}

            {/* Safety reasoning */}
            {opt.safetyReasoning && (
                <div style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11,
                    color: opt.safetyScore >= 8 ? "#22c55e" : opt.safetyScore >= 5 ? "#eab308" : "#ef4444",
                    padding: "4px 8px",
                    background: opt.safetyScore >= 8
                        ? "rgba(34,197,94,.06)"
                        : opt.safetyScore >= 5
                        ? "rgba(234,179,8,.06)"
                        : "rgba(239,68,68,.06)",
                    border: opt.safetyScore >= 8
                        ? "1px solid rgba(34,197,94,.12)"
                        : opt.safetyScore >= 5
                        ? "1px solid rgba(234,179,8,.12)"
                        : "1px solid rgba(239,68,68,.12)",
                    marginBottom: opt.whyBest ? 6 : 0,
                }}>
                    {"\u25C9"} {opt.safetyReasoning}
                </div>
            )}

            {/* Why best */}
            {isBest && opt.whyBest && (
                <div style={{
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 11, color: Y,
                    opacity: 0.8,
                    fontStyle: "italic",
                }}>
                    {opt.whyBest}
                </div>
            )}
        </div>
    );
}

function TransportStat({ label, value, highlight, color }) {
    return (
        <div>
            <div style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 9, color: "rgba(255,255,255,.3)",
                letterSpacing: 1, marginBottom: 1,
            }}>
                {label}
            </div>
            <div style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 15,
                color: color || (highlight ? Y : "rgba(255,255,255,.55)"),
                letterSpacing: 0.5,
            }}>
                {value}
            </div>
        </div>
    );
}
