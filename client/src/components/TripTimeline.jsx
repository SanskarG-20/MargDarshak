import { useEffect, useState } from "react";
import { Y, WH } from "../constants/theme";

export default function TripTimeline({ itinerary }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 250);
        return () => clearTimeout(timer);
    }, []);

    if (!Array.isArray(itinerary) || itinerary.length === 0) return null;

    return (
        <div
            style={{
                marginBottom: 18,
                border: "1px solid rgba(204,255,0,.12)",
                background: "rgba(204,255,0,.02)",
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
            }}
        >
            <div
                style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid rgba(204,255,0,.08)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: Y,
                        boxShadow: `0 0 6px ${Y}`,
                        display: "inline-block",
                    }}
                />
                <span
                    style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 13,
                        letterSpacing: 2.5,
                        color: Y,
                    }}
                >
                    TRIP TIMELINE
                </span>
                <span
                    style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 10,
                        color: "rgba(255,255,255,.3)",
                        marginLeft: "auto",
                        letterSpacing: 1,
                    }}
                >
                    STRUCTURED PLAN
                </span>
            </div>

            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {itinerary.map((item, index) => (
                    <div
                        key={`${item.time || "time"}-${item.place || "place"}-${index}`}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "96px 1fr",
                            gap: 12,
                            alignItems: "start",
                        }}
                    >
                        <div
                            style={{
                                position: "relative",
                                paddingTop: 2,
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 16,
                                    color: Y,
                                    letterSpacing: 1.2,
                                }}
                            >
                                {item.time || "Anytime"}
                            </div>
                            {index < itinerary.length - 1 && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 26,
                                        left: 4,
                                        width: 1,
                                        bottom: -18,
                                        background: "rgba(204,255,0,.18)",
                                    }}
                                />
                            )}
                        </div>

                        <div
                            style={{
                                padding: "10px 12px",
                                border: "1px solid rgba(255,255,255,.08)",
                                background: "rgba(255,255,255,.02)",
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: "'DM Sans',sans-serif",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: WH,
                                    marginBottom: 4,
                                }}
                            >
                                {item.place || "Planned stop"}
                            </div>
                            <div
                                style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "6px 14px",
                                    fontFamily: "'DM Sans',sans-serif",
                                    fontSize: 12,
                                    color: "rgba(255,255,255,.58)",
                                    lineHeight: 1.5,
                                }}
                            >
                                <span>{item.transport || "Flexible transport"}</span>
                                <span style={{ color: Y }}>{item.cost || "Cost varies"}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
