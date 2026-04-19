function toRadians(value) {
    return (value * Math.PI) / 180;
}

function haversineMeters(a, b) {
    if (
        !Number.isFinite(a?.lat) ||
        !Number.isFinite(a?.lng) ||
        !Number.isFinite(b?.lat) ||
        !Number.isFinite(b?.lng)
    ) {
        return Infinity;
    }

    const earthRadius = 6371000;
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    return earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function getUrgency(distanceRemainingMeters, delayMinutes, deviationMeters) {
    if (deviationMeters > 300 || delayMinutes >= 10 || distanceRemainingMeters <= 800) {
        return "high";
    }
    if (delayMinutes >= 5 || distanceRemainingMeters <= 2000) {
        return "medium";
    }
    return "low";
}

function getNextStopCue(journey, distanceRemainingMeters) {
    const mode = String(journey?.bestRoute?.mode || "").toLowerCase();
    if (!["metro", "train", "transit"].includes(mode)) return null;
    if (distanceRemainingMeters > 1200) return null;

    return {
        summary: "Prepare to get down soon.",
        action: `Get down at the next stop for ${journey?.destination?.name || "your destination"} and be ready for the final transfer.`,
        reason: "You are close to your destination corridor.",
    };
}

export function buildCopilotSnapshot({
    journey,
    position,
    weather,
    deviation,
    delay,
}) {
    if (!journey || !position || !journey.destination) return null;

    const distanceRemainingMeters = Math.round(haversineMeters(position, journey.destination));
    const nextStopCue = getNextStopCue(journey, distanceRemainingMeters);
    const urgency = getUrgency(
        distanceRemainingMeters,
        Number(delay?.delayMinutes) || 0,
        Number(deviation?.deviationMeters) || 0
    );

    return {
        journeyLabel: journey.destination?.name || "Active journey",
        mode: journey.bestRoute?.label || journey.bestRoute?.mode || "route",
        distanceRemainingMeters,
        delayMinutes: Number(delay?.delayMinutes) || 0,
        deviationMeters: Number(deviation?.deviationMeters) || 0,
        crowdLevel: journey.bestRoute?.crowdLevel || null,
        weatherLabel: weather?.weatherLabel || null,
        rainProbability: weather?.rainProbability ?? null,
        aqi: weather?.aqi ?? null,
        nextStopCue,
        urgency,
    };
}

export function getHeuristicCopilotSuggestion(snapshot) {
    if (!snapshot) return null;

    if (snapshot.nextStopCue) {
        return {
            id: `next-stop:${snapshot.journeyLabel}`,
            source: "heuristic",
            interruptible: true,
            ...snapshot.nextStopCue,
            urgency: "high",
        };
    }

    if (snapshot.deviationMeters > 300) {
        return {
            id: `deviation:${snapshot.deviationMeters}`,
            source: "heuristic",
            summary: "You are drifting off the planned route.",
            action: "Pause and re-check the route before continuing.",
            reason: `Current deviation is about ${snapshot.deviationMeters} m.`,
            urgency: "high",
            interruptible: true,
        };
    }

    if (snapshot.delayMinutes >= 8) {
        return {
            id: `delay:${snapshot.delayMinutes}`,
            source: "heuristic",
            summary: "Your trip is slowing down.",
            action: "Watch for a faster transfer or follow the reroute suggestion if one appears.",
            reason: `Estimated live delay is ${snapshot.delayMinutes} min.`,
            urgency: "medium",
            interruptible: true,
        };
    }

    if (snapshot.rainProbability != null && snapshot.rainProbability >= 60) {
        return {
            id: `rain:${snapshot.rainProbability}`,
            source: "heuristic",
            summary: "Rain disruption risk is rising.",
            action: "Keep an umbrella ready and prefer covered exits or enclosed transfers.",
            reason: `Rain probability is ${snapshot.rainProbability}%.`,
            urgency: "medium",
            interruptible: true,
        };
    }

    if (snapshot.aqi != null && snapshot.aqi >= 150) {
        return {
            id: `aqi:${snapshot.aqi}`,
            source: "heuristic",
            summary: "Air quality is poor right now.",
            action: "Reduce long outdoor waits and prefer enclosed transit if possible.",
            reason: `AQI is ${snapshot.aqi}.`,
            urgency: "medium",
            interruptible: true,
        };
    }

    if (snapshot.distanceRemainingMeters <= 2000) {
        return {
            id: `arrival:${Math.round(snapshot.distanceRemainingMeters / 100)}`,
            source: "heuristic",
            summary: "You are approaching the final stretch.",
            action: "Keep your destination details ready and prepare for the last transfer or walk.",
            reason: `About ${Math.round(snapshot.distanceRemainingMeters / 1000 * 10) / 10} km remaining.`,
            urgency: "low",
            interruptible: true,
        };
    }

    return {
        id: `steady:${snapshot.journeyLabel}:${snapshot.mode}`,
        source: "heuristic",
        summary: "Journey looks steady.",
        action: "Stay on the current route and keep following live updates.",
        reason: `${snapshot.mode} remains the best option for now.`,
        urgency: "low",
        interruptible: true,
    };
}
