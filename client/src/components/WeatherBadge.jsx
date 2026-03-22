import { Y, BK, WH } from "../constants/theme";

/**
 * WeatherBadge — Displays current weather + AQI on the dashboard.
 *
 * Props:
 *  - weather: object from fetchWeatherAndAQI()
 *  - loading: boolean
 *  - city: string | null
 */
export default function WeatherBadge({ weather, loading, city }) {
    if (loading) {
        return (
            <div data-tour="weather-badge" style={containerStyle}>
                <div style={headerStyle}>
                    <Dot color={Y} pulse />
                    WEATHER
                </div>
                <div style={loadingTextStyle}>Fetching weather data...</div>
            </div>
        );
    }

    if (!weather) return null;

    return (
        <div data-tour="weather-badge" style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <Dot color="#22c55e" />
                WEATHER{city ? ` — ${city.toUpperCase()}` : ""}
            </div>

            {/* Main weather row */}
            <div style={mainRowStyle}>
                {/* Temperature + icon */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 32, lineHeight: 1 }}>
                        {weather.weatherIcon}
                    </span>
                    <div>
                        <div
                            style={{
                                fontFamily: "'Bebas Neue',sans-serif",
                                fontSize: 36,
                                color: WH,
                                lineHeight: 1,
                            }}
                        >
                            {weather.temperature}°
                            <span style={{ fontSize: 18, color: "rgba(255,255,255,.4)" }}>C</span>
                        </div>
                        <div
                            style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 13,
                                color: "rgba(255,255,255,.5)",
                                marginTop: 2,
                            }}
                        >
                            {weather.weatherLabel}
                        </div>
                    </div>
                </div>

                {/* Stats grid */}
                <div style={statsGridStyle}>
                    <StatItem label="FEELS LIKE" value={`${weather.feelsLike}°C`} />
                    <StatItem label="HUMIDITY" value={`${weather.humidity}%`} />
                    <StatItem label="WIND" value={`${weather.windSpeed} km/h`} />
                    {weather.rainProbability != null && weather.rainProbability > 0 && (
                        <StatItem
                            label="RAIN"
                            value={`${weather.rainProbability}%`}
                            highlight={weather.rainProbability >= 50}
                        />
                    )}
                    {weather.uvIndex != null && (
                        <StatItem
                            label="UV INDEX"
                            value={weather.uvIndex}
                            highlight={weather.uvIndex >= 6}
                        />
                    )}
                </div>
            </div>

            {/* AQI bar */}
            {weather.aqi != null && (
                <div style={aqiBarStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: weather.aqiColor,
                                display: "inline-block",
                                boxShadow: `0 0 6px ${weather.aqiColor}`,
                            }}
                        />
                        <span
                            style={{
                                fontFamily: "'Bebas Neue',sans-serif",
                                fontSize: 13,
                                color: "rgba(255,255,255,.4)",
                                letterSpacing: 2,
                            }}
                        >
                            AIR QUALITY
                        </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                            style={{
                                fontFamily: "'Bebas Neue',sans-serif",
                                fontSize: 20,
                                color: weather.aqiColor,
                            }}
                        >
                            AQI {weather.aqi}
                        </span>
                        <span
                            style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 12,
                                color: weather.aqiColor,
                                opacity: 0.8,
                            }}
                        >
                            {weather.aqiLabel}
                        </span>
                    </div>
                    {(weather.pm25 != null || weather.pm10 != null) && (
                        <div
                            style={{
                                display: "flex",
                                gap: 12,
                                marginTop: 4,
                                flexWrap: "wrap",
                            }}
                        >
                            {weather.pm25 != null && (
                                <span style={pmStyle}>
                                    PM2.5: {weather.pm25} µg/m³
                                </span>
                            )}
                            {weather.pm10 != null && (
                                <span style={pmStyle}>
                                    PM10: {weather.pm10} µg/m³
                                </span>
                            )}
                        </div>
                    )}
                </div>
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
                animation: pulse ? "pulse-ring 1.5s ease infinite" : "pulse-ring 2s ease infinite",
            }}
        />
    );
}

function StatItem({ label, value, highlight }) {
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
                    fontSize: 16,
                    color: highlight ? "#f97316" : "rgba(255,255,255,.7)",
                    letterSpacing: 1,
                }}
            >
                {value}
            </div>
        </div>
    );
}

/* ── Styles ──────────────────────────────────── */

const containerStyle = {
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.02)",
    padding: "16px 16px",
    marginBottom: 24,
};

const headerStyle = {
    fontFamily: "'Bebas Neue',sans-serif",
    fontSize: 16,
    color: Y,
    letterSpacing: 2,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 10,
};

const loadingTextStyle = {
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    color: "rgba(255,255,255,.3)",
    animation: "pulse-ring 1.5s ease infinite",
};

const mainRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 20,
};

const statsGridStyle = {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
};

const aqiBarStyle = {
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,.06)",
};

const pmStyle = {
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 11,
    color: "rgba(255,255,255,.3)",
};
