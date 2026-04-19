import { useEffect, useState } from "react";
import { Y, BK, WH } from "../constants/theme";
import { getUserTravelAnalytics } from "../services/analyticsService";

const BAR_COLORS = ["#CCFF00", "#22c55e", "#06b6d4", "#f97316", "#a78bfa", "#ef4444"];

export default function TravelAnalyticsPanel({ dbUser }) {
    const [loading, setLoading] = useState(false);
    const [analytics, setAnalytics] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function loadAnalytics() {
            if (!dbUser?.id) {
                setAnalytics(null);
                return;
            }

            setLoading(true);
            const data = await getUserTravelAnalytics(dbUser.id);
            if (!cancelled) {
                setAnalytics(data);
                setLoading(false);
            }
        }

        loadAnalytics();

        const refresh = () => loadAnalytics();
        window.addEventListener("savedtrips:refresh", refresh);
        return () => {
            cancelled = true;
            window.removeEventListener("savedtrips:refresh", refresh);
        };
    }, [dbUser?.id]);

    if (!dbUser?.id) return null;

    const hasData = analytics && analytics.totalTrips > 0;

    return (
        <div style={{ marginBottom: 24 }}>
            <div style={headerStyle}>
                <span style={dotStyle} />
                TRAVEL ANALYTICS
            </div>

            <div style={panelStyle}>
                {loading && (
                    <div style={emptyStyle}>Calculating your travel insights...</div>
                )}

                {!loading && !hasData && (
                    <div style={emptyStyle}>
                        No analytics yet.
                        <br />
                        <span style={{ fontSize: 11, opacity: 0.65 }}>
                            Ask the AI for routes or save trips to unlock your travel dashboard.
                        </span>
                    </div>
                )}

                {!loading && hasData && (
                    <>
                        <div style={metricsGridStyle}>
                            <MetricCard label="TOTAL TRIPS" value={analytics.totalTrips} hint="saved + AI planned" />
                            <MetricCard label="AVG COST" value={`₹${analytics.avgCost}`} hint="estimated per trip" />
                            <MetricCard label="TIME SAVED" value={`${analytics.timeSavedMinutes} min`} hint="vs cab-heavy travel" />
                            <MetricCard label="CO2 SAVED" value={`${analytics.co2SavedKg} kg`} hint="lower-emission choices" />
                        </div>

                        <div style={summaryStripStyle}>
                            <span>Most used mode: <strong style={{ color: Y }}>{analytics.topMode || "Mixed"}</strong></span>
                            <span>Peak travel window: <strong style={{ color: Y }}>{analytics.peakTravelWindow || "Not enough data"}</strong></span>
                            <span>Saved routes: <strong style={{ color: Y }}>{analytics.savedTripsCount}</strong></span>
                        </div>

                        <div style={chartsGridStyle}>
                            <ChartCard title="MODE SHARE">
                                {analytics.modeBreakdown.map((item, index) => (
                                    <BarRow
                                        key={item.mode}
                                        label={item.label}
                                        value={`${item.share}%`}
                                        width={item.share}
                                        color={BAR_COLORS[index % BAR_COLORS.length]}
                                    />
                                ))}
                            </ChartCard>

                            <ChartCard title="TIME OF DAY">
                                {analytics.timeBuckets.map((bucket, index) => {
                                    const maxCount = Math.max(...analytics.timeBuckets.map((entry) => entry.count), 1);
                                    const width = (bucket.count / maxCount) * 100;
                                    return (
                                        <BarRow
                                            key={bucket.key}
                                            label={bucket.label}
                                            value={`${bucket.count}`}
                                            width={width}
                                            color={BAR_COLORS[(index + 1) % BAR_COLORS.length]}
                                        />
                                    );
                                })}
                            </ChartCard>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function MetricCard({ label, value, hint }) {
    return (
        <div
            style={{
                padding: "14px 14px 12px",
                border: "1px solid rgba(255,255,255,.08)",
                background: "rgba(255,255,255,.02)",
            }}
        >
            <div style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 10,
                letterSpacing: 1.2,
                color: "rgba(255,255,255,.35)",
                marginBottom: 6,
            }}>
                {label}
            </div>
            <div style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 28,
                letterSpacing: 1,
                color: WH,
                marginBottom: 4,
            }}>
                {value}
            </div>
            <div style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,.4)",
            }}>
                {hint}
            </div>
        </div>
    );
}

function ChartCard({ title, children }) {
    return (
        <div
            style={{
                padding: "14px 14px 12px",
                border: "1px solid rgba(255,255,255,.08)",
                background: "rgba(255,255,255,.02)",
            }}
        >
            <div style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 14,
                letterSpacing: 2,
                color: Y,
                marginBottom: 12,
            }}>
                {title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {children}
            </div>
        </div>
    );
}

function BarRow({ label, value, width, color }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "96px 1fr 44px", gap: 10, alignItems: "center" }}>
            <div style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,.62)",
            }}>
                {label}
            </div>
            <div style={{
                position: "relative",
                height: 10,
                background: "rgba(255,255,255,.06)",
                overflow: "hidden",
            }}>
                <div style={{
                    height: "100%",
                    width: `${Math.max(6, width)}%`,
                    background: color,
                    boxShadow: `0 0 10px ${color}33`,
                }} />
            </div>
            <div style={{
                fontFamily: "'Bebas Neue',sans-serif",
                fontSize: 14,
                color: color,
                textAlign: "right",
            }}>
                {value}
            </div>
        </div>
    );
}

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

const dotStyle = {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: Y,
    display: "inline-block",
    boxShadow: `0 0 8px ${Y}`,
};

const panelStyle = {
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.02)",
    padding: 16,
};

const metricsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 12,
};

const chartsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
};

const summaryStripStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    marginBottom: 12,
    padding: "10px 12px",
    border: "1px solid rgba(204,255,0,.08)",
    background: "rgba(204,255,0,.03)",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 12,
    color: "rgba(255,255,255,.6)",
};

const emptyStyle = {
    padding: "24px 20px",
    textAlign: "center",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    color: "rgba(255,255,255,.35)",
    lineHeight: 1.7,
};
