import { useState } from "react";
import { Mic } from "lucide-react";
import { Y, BK, WH } from "../constants/theme";
import { saveIntent, getIntents } from "../services/supabaseClient";

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

export default function IntentInput({ dbUser }) {
    const [query, setQuery] = useState("");
    const [intents, setIntents] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const userId = dbUser?.id;

    // Load past intents on first render
    if (userId && !loaded) {
        setLoaded(true);
        getIntents(userId).then(setIntents);
    }

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
            setQuery(transcript);
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim() || !userId || saving) return;

        setSaving(true);
        const saved = await saveIntent({ userId, query: query.trim() });
        setSaving(false);

        if (saved) {
            setIntents((prev) => [saved, ...prev]);
            setQuery("");
        }
    };

    return (
        <div data-tour="query-input" style={{ marginTop: 32 }}>
            {/* Section header */}
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
                TRAVEL INTENT
            </div>

            {/* Input form */}
            <form
                onSubmit={handleSubmit}
                style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 24,
                }}
            >
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Where do you want to go? What do you need?"
                    style={{
                        flex: 1,
                        padding: "14px 18px",
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 15,
                        color: WH,
                        background: "rgba(255,255,255,.05)",
                        border: `2px solid rgba(255,255,255,.15)`,
                        outline: "none",
                        transition: "border-color .2s",
                    }}
                    onFocus={(e) =>
                        (e.target.style.borderColor = Y)
                    }
                    onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,.15)")
                    }
                />
                <button
                    type="submit"
                    disabled={saving || !query.trim()}
                    data-hover
                    style={{
                        padding: "14px 18px",
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 14,
                        letterSpacing: 1.5,
                        color: BK,
                        background: saving ? "rgba(204,255,0,.5)" : Y,
                        border: `2px solid ${Y}`,
                        cursor: saving ? "wait" : "pointer",
                        transition: "all .15s",
                        whiteSpace: "nowrap",
                    }}
                >
                    {saving ? "SAVING..." : "SAVE INTENT →"}
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

            {/* Past intents list */}
            {intents.length > 0 && (
                <div>
                    <div
                        style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontSize: 12,
                            color: "rgba(255,255,255,.35)",
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            marginBottom: 12,
                        }}
                    >
                        Recent Intents
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {intents.slice(0, 5).map((intent) => (
                            <div
                                key={intent.id}
                                style={{
                                    padding: "12px 16px",
                                    background: "rgba(255,255,255,.03)",
                                    borderLeft: `3px solid ${Y}`,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 16,
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 14,
                                        color: "rgba(255,255,255,.7)",
                                    }}
                                >
                                    {intent.query}
                                </span>
                                <span
                                    style={{
                                        fontFamily: "'DM Sans',sans-serif",
                                        fontSize: 11,
                                        color: "rgba(255,255,255,.25)",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {new Date(intent.created_at).toLocaleString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
