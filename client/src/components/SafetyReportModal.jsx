import { useEffect, useState } from "react";
import { Y, BK, WH } from "../constants/theme";

const CATEGORIES = [
    { key: "road_hazard", label: "▲ Road Hazard" },
    { key: "poor_lighting", label: "◎ Poor Lighting" },
    { key: "flooding", label: "◈ Flooding" },
    { key: "unsafe_area", label: "◉ Unsafe Area" },
    { key: "traffic_accident", label: "◆ Accident" },
    { key: "other", label: "◇ Other" },
];

const SEVERITIES = [
    { value: 1, label: "LOW", color: "#22c55e" },
    { value: 2, label: "MEDIUM", color: "#f59e0b" },
    { value: 3, label: "HIGH", color: "#ef4444" },
];

export default function SafetyReportModal({ lat, lng, onSubmit, onClose, isOpen }) {
    const [category, setCategory] = useState("");
    const [severity, setSeverity] = useState(2);
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);
    const [reported, setReported] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setCategory("");
            setSeverity(2);
            setDescription("");
            setLoading(false);
            setReported(false);
        }
    }, [isOpen]);

    if (!isOpen || lat == null || lng == null) return null;

    const handleSubmit = async () => {
        if (!category || loading) return;

        setLoading(true);
        const ok = await onSubmit?.({
            category,
            severity,
            description,
        });

        if (!ok) {
            setLoading(false);
            return;
        }

        setLoading(false);
        setReported(true);
        setTimeout(() => {
            onClose?.();
        }, 1500);
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.8)",
                zIndex: 2000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: BK,
                    border: `1.5px solid ${Y}`,
                    borderRadius: 16,
                    padding: 28,
                    width: 360,
                    maxWidth: "90vw",
                }}
            >
                <div
                    style={{
                        fontFamily: "'Black Han Sans', 'DM Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: 14,
                        letterSpacing: "2px",
                        color: Y,
                        marginBottom: 8,
                    }}
                >
                    REPORT INCIDENT
                </div>

                <div
                    style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 12,
                        color: "rgba(255,255,255,.6)",
                        marginBottom: 14,
                    }}
                >
                    {`📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 12,
                    }}
                >
                    {CATEGORIES.map((item) => {
                        const selected = category === item.key;
                        return (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => setCategory(item.key)}
                                style={{
                                    borderRadius: 999,
                                    border: selected
                                        ? `1px solid ${Y}`
                                        : "1px solid rgba(204,255,0,.4)",
                                    background: selected ? Y : "transparent",
                                    color: selected ? BK : "rgba(255,255,255,.7)",
                                    padding: "7px 10px",
                                    fontSize: 11,
                                    fontFamily: "'DM Sans',sans-serif",
                                    cursor: "pointer",
                                }}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        marginBottom: 12,
                    }}
                >
                    {SEVERITIES.map((item) => {
                        const selected = severity === item.value;
                        return (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setSeverity(item.value)}
                                style={{
                                    flex: 1,
                                    borderRadius: 999,
                                    border: selected ? `1px solid ${item.color}` : "1px solid rgba(255,255,255,.15)",
                                    background: selected ? `${item.color}22` : "transparent",
                                    color: item.color,
                                    padding: "8px 6px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    fontFamily: "'DM Sans',sans-serif",
                                    cursor: "pointer",
                                }}
                            >
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description (optional)"
                    rows={2}
                    style={{
                        width: "100%",
                        resize: "none",
                        background: "#111",
                        border: "1px solid #333",
                        color: WH,
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 13,
                        marginBottom: 14,
                        fontFamily: "'DM Sans',sans-serif",
                    }}
                />

                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!category || loading || reported}
                    style={{
                        width: "100%",
                        background: Y,
                        color: BK,
                        fontWeight: 800,
                        borderRadius: 50,
                        border: "none",
                        padding: 12,
                        cursor: !category || loading || reported ? "not-allowed" : "pointer",
                        opacity: !category || loading || reported ? 0.65 : 1,
                        fontFamily: "'DM Sans',sans-serif",
                        letterSpacing: 0.6,
                    }}
                >
                    {reported ? "✓ REPORTED" : loading ? "SUBMITTING..." : "SUBMIT REPORT"}
                </button>
            </div>
        </div>
    );
}
