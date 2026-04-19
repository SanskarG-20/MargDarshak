const PEAK_WINDOWS = [
    { start: 8, end: 11 },
    { start: 18, end: 21 },
];

const HIGH_AQI_THRESHOLD = 150;

function isPeakHour(date = new Date()) {
    const hour = date.getHours();
    return PEAK_WINDOWS.some((window) => hour >= window.start && hour < window.end);
}

function roundToNearestFive(value) {
    return Math.max(5, Math.round(value / 5) * 5);
}

function toMinutes(durationLike) {
    if (durationLike == null) return null;
    if (typeof durationLike === "number" && Number.isFinite(durationLike)) {
        return Math.round(durationLike / 60);
    }

    const value = String(durationLike).toLowerCase().trim();
    const hourMatch = value.match(/(\d+)\s*h\s*(?:(\d+)\s*m)?/);
    if (hourMatch) {
        return Number(hourMatch[1]) * 60 + Number(hourMatch[2] || 0);
    }

    const minuteMatch = value.match(/(\d+)\s*min/);
    if (minuteMatch) {
        return Number(minuteMatch[1]);
    }

    return null;
}

function getBaseJourneyMinutes(currentJourney) {
    if (!currentJourney) return 45;

    const fromBest = toMinutes(
        currentJourney.bestRoute?.durationSec ?? currentJourney.bestRoute?.duration
    );
    if (fromBest != null) return fromBest;

    const routeDurations = (currentJourney.routes || [])
        .map((route) => toMinutes(route.durationSec ?? route.duration))
        .filter((value) => value != null);

    if (routeDurations.length > 0) {
        return Math.min(...routeDurations);
    }

    return 45;
}

function buildRainAlert(weather, baseJourneyMinutes) {
    const rainProbability = Number(weather?.rainProbability);
    if (!Number.isFinite(rainProbability) || rainProbability <= 40) return null;

    const delayFactor = rainProbability > 60 ? 0.2 : 0.1;
    const delayMinutes = roundToNearestFive(baseJourneyMinutes * delayFactor);

    return {
        id: "rain-delay",
        severity: rainProbability > 75 ? "high" : "medium",
        type: "weather",
        title: rainProbability > 60 ? "Rain delays likely" : "Light rain impact possible",
        message:
            rainProbability > 60
                ? `Rain probability is ${rainProbability}%. Leave about ${delayMinutes} min early.`
                : `Rain probability is ${rainProbability}%. Keep a small ${delayMinutes} min buffer.`,
        recommendation:
            rainProbability > 60
                ? "Prefer a sheltered or enclosed mode if available."
                : "Carry a light rain backup and expect slower boarding.",
        extraDelayMinutes: delayMinutes,
    };
}

function buildPeakHourAlert(currentJourney, baseJourneyMinutes) {
    if (!isPeakHour()) return null;

    const crowdedMode = ["bus", "metro", "train", "transit"].includes(
        String(currentJourney?.bestRoute?.mode || "").toLowerCase()
    );
    const delayMinutes = roundToNearestFive(baseJourneyMinutes * (crowdedMode ? 0.15 : 0.1));

    return {
        id: "peak-hour",
        severity: crowdedMode ? "medium" : "low",
        type: "congestion",
        title: "Peak hour congestion building",
        message: crowdedMode
            ? `Peak-hour demand is rising. Leave ${delayMinutes} min early for a smoother trip.`
            : `Road congestion is rising. Add a ${delayMinutes} min buffer before departure.`,
        recommendation: crowdedMode
            ? "Expect fuller platforms or coaches than usual."
            : "Road travel may take longer than the route estimate.",
        crowdDelta: crowdedMode ? 1 : 0,
        extraDelayMinutes: delayMinutes,
    };
}

function buildAqiAlert(weather) {
    const aqi = Number(weather?.aqi);
    if (!Number.isFinite(aqi) || aqi < HIGH_AQI_THRESHOLD) return null;

    const severe = aqi >= 200;
    return {
        id: "aqi-spike",
        severity: severe ? "high" : "medium",
        type: "air-quality",
        title: severe ? "AQI spike detected" : "Air quality worsening",
        message: `Current AQI is ${aqi}${weather?.aqiLabel ? ` (${weather.aqiLabel})` : ""}. Limit long outdoor transfers if possible.`,
        recommendation: severe
            ? "Prefer enclosed transit or cabs until the air quality improves."
            : "Carry a mask if your route includes long outdoor stretches.",
        extraDelayMinutes: 0,
    };
}

function buildSummaryAlert(alerts, currentJourney) {
    if (alerts.length === 0) return null;

    const extraDelayMinutes = alerts.reduce(
        (maxDelay, alert) => Math.max(maxDelay, Number(alert.extraDelayMinutes) || 0),
        0
    );

    const crowdIncrease = alerts.some((alert) => alert.crowdDelta > 0);
    const routeName = currentJourney?.destination?.name || "your trip";

    if (extraDelayMinutes <= 0 && !crowdIncrease) return null;

    let message = `For ${routeName}, leave ${extraDelayMinutes || 5} min early`;
    if (crowdIncrease) {
        message += " and expect higher crowding than usual.";
    } else {
        message += ".";
    }

    return {
        id: "summary",
        severity: alerts.some((alert) => alert.severity === "high") ? "high" : "medium",
        type: "summary",
        title: "Predictive travel alert",
        message,
        recommendation: "These suggestions are rule-based and update as conditions change.",
        extraDelayMinutes,
    };
}

export function getPredictiveTravelAlerts({ weather = null, currentJourney = null } = {}) {
    if (!weather && !currentJourney) {
        return { alerts: [], summary: null, factors: { peakHour: false } };
    }

    const baseJourneyMinutes = getBaseJourneyMinutes(currentJourney);
    const alerts = [
        buildRainAlert(weather, baseJourneyMinutes),
        buildPeakHourAlert(currentJourney, baseJourneyMinutes),
        buildAqiAlert(weather),
    ].filter(Boolean);

    return {
        alerts,
        summary: buildSummaryAlert(alerts, currentJourney),
        factors: {
            peakHour: isPeakHour(),
            rainProbability: weather?.rainProbability ?? null,
            aqi: weather?.aqi ?? null,
        },
    };
}

