import { Y, BK, WH } from "../constants/theme";

const URGENCY_COLORS = {
    low: "rgba(255,255,255,.7)",
    medium: "#f59e0b",
    high: "#ef4444",
};

export default function ContinuousCopilotPanel({
    visible,
    journeyActive,
    copilotEnabled,
    suggestion,
    onToggle,
    onDismiss,
}) {
    if (!visible || !journeyActive) return null;

    const urgencyColor = URGENCY_COLORS[suggestion?.urgency] || Y;

    return (
        <div
            style={{
                position: "fixed",
                right: 18,
                bottom: 24,
                zIndex: 260,
                width: "min(92vw, 360px)",
                border: "1px solid rgba(204,255,0,.2)",
                background: "rgba(0,0,0,.92)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 18px 48px rgba(0,0,0,.32)",
                animation: "ldm-step-in 0.25s ease both",
            }}
        >
            <div
                style={{
                    padding: "12px 14px",
                    borderBottom: "1px solid rgba(255,255,255,.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: copilotEnabled ? Y : "rgba(255,255,255,.24)",
                            boxShadow: copilotEnabled ? `0 0 8px ${Y}` : "none",
                            display: "inline-block",
                        }}
                    />
                    <span
                        style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 15,
                            letterSpacing: 1.8,
                            color: Y,
                        }}
                    >
                        AI COPILOT
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onToggle}
                    style={{
                        border: `1px solid ${copilotEnabled ? Y : "rgba(255,255,255,.2)"}`,
                        background: copilotEnabled ? Y : "transparent",
                        color: copilotEnabled ? BK : "rgba(255,255,255,.72)",
                        padding: "5px 10px",
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 12,
                        letterSpacing: 1.2,
                        cursor: "pointer",
                    }}
                >
                    {copilotEnabled ? "PAUSE" : "RESUME"}
                </button>
            </div>

            <div style={{ padding: "14px 14px 12px" }}>
                <div
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 8px",
                        border: `1px solid ${urgencyColor}33`,
                        color: urgencyColor,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 1,
                        textTransform: "uppercase",
                        marginBottom: 10,
                    }}
                >
                    {suggestion?.urgency || "live"} priority
                </div>

                <div
                    style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 22,
                        lineHeight: 1,
                        color: WH,
                        marginBottom: 10,
                    }}
                >
                    {suggestion?.summary || "Live journey monitoring active"}
                </div>

                <div
                    style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "rgba(255,255,255,.72)",
                        marginBottom: 10,
                    }}
                >
                    {suggestion?.action || "The copilot will keep watching route changes, weather, and timing while your journey is active."}
                </div>

                {suggestion?.reason && (
                    <div
                        style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontSize: 11,
                            lineHeight: 1.5,
                            color: "rgba(255,255,255,.45)",
                            marginBottom: 12,
                        }}
                    >
                        {suggestion.reason}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span
                        style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontSize: 11,
                            color: "rgba(255,255,255,.35)",
                        }}
                    >
                        {copilotEnabled ? "Continuous guidance running" : "Copilot paused"}
                    </span>
                    <button
                        type="button"
                        onClick={onDismiss}
                        style={{
                            border: "1px solid rgba(255,255,255,.14)",
                            background: "transparent",
                            color: "rgba(255,255,255,.72)",
                            padding: "6px 10px",
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 12,
                            letterSpacing: 1.1,
                            cursor: "pointer",
                        }}
                    >
                        DISMISS
                    </button>
                </div>
            </div>
        </div>
    );
}
