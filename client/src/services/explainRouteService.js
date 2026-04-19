/**
 * Explainable AI — Route Reasoning Engine for MargDarshak AI.
 *
 * After the best transport option is selected, this module generates
 * a human-readable explanation comparing it against all alternatives.
 *
 * Uses: ETA comparison, cost comparison, AQI, peak hour status,
 *       safety score, crowd level.
 */

/**
 * Check if current time falls within peak hours.
 * Morning: 8-11 AM, Evening: 6-9 PM
 */
function isPeakHour() {
    const h = new Date().getHours();
    return (h >= 8 && h < 11) || (h >= 18 && h < 21);
}

/**
 * Parse a duration string like "25 min", "1h 20m", "45s" into total minutes.
 */
function parseDurationMin(durationStr) {
    if (!durationStr) return null;
    const s = durationStr.toLowerCase().trim();

    // "1h 20m" or "2h"
    const hm = s.match(/(\d+)\s*h\s*(?:(\d+)\s*m)?/);
    if (hm) return parseInt(hm[1]) * 60 + (parseInt(hm[2]) || 0);

    // "25 min"
    const m = s.match(/(\d+)\s*min/);
    if (m) return parseInt(m[1]);

    // "45s"
    const sec = s.match(/(\d+)\s*s/);
    if (sec) return Math.round(parseInt(sec[1]) / 60);

    return null;
}

/**
 * Parse cost string like "₹150", "Free" into numeric amount.
 */
function parseCostAmount(costStr) {
    if (!costStr) return null;
    if (costStr === "Free" || costStr === "₹0") return 0;
    // Extract only the FIRST number (handles ranges like "₹400-580")
    const m = costStr.match(/[\d,]+/);
    return m ? parseInt(m[0].replace(/,/g, "")) : null;
}

function getPreferredModeWeight(preferredModes, mode) {
    if (!preferredModes || !mode) return 0;
    const key = mode.toLowerCase();
    if (key === "bus") return Number(preferredModes.bus || preferredModes.transit || 0);
    if (key === "transit") return Number(preferredModes.transit || preferredModes.bus || 0);
    return Number(preferredModes[key] || 0);
}

/**
 * AQI label mapping.
 */
const AQI_LABELS = {
    1: { label: "Good", outdoor: true },
    2: { label: "Moderate", outdoor: true },
    3: { label: "Unhealthy (Sensitive)", outdoor: false },
    4: { label: "Unhealthy", outdoor: false },
    5: { label: "Very Unhealthy", outdoor: false },
};

/**
 * Generate explanation reasons for why a transport mode was selected as best.
 *
 * @param {Object}   bestOption   - The mode object marked isBest: true
 * @param {Object[]} allOptions   - All mode objects
 * @param {Object|null} weather   - Weather data { aqi, aqiLabel, temperature, rainProbability, ... }
 * @returns {{ reasons: string[], summary: string }}
 */
export function explainBestRoute(bestOption, allOptions, weather = null, preferences = null) {
    if (!bestOption || allOptions.length <= 1) {
        return { reasons: ["Only available transport option"], summary: "Single option available." };
    }

    const others = allOptions.filter((o) => o.mode !== bestOption.mode);
    const reasons = [];

    // ── 1. ETA Comparison ──────────────────────────────────────────
    const bestMin = bestOption.durationSec
        ? Math.round(bestOption.durationSec / 60)
        : parseDurationMin(bestOption.duration);

    if (bestMin != null) {
        let maxOtherMin = 0;
        let slowestLabel = "";
        for (const o of others) {
            const oMin = o.durationSec
                ? Math.round(o.durationSec / 60)
                : parseDurationMin(o.duration);
            if (oMin != null && oMin > maxOtherMin) {
                maxOtherMin = oMin;
                slowestLabel = o.label || o.mode;
            }
        }
        const diff = maxOtherMin - bestMin;
        if (diff >= 5) {
            reasons.push(diff + " minutes faster than " + slowestLabel);
        } else if (diff > 0) {
            reasons.push("Faster travel time");
        }
    }

    // ── 2. Cost Comparison ─────────────────────────────────────────
    const bestCost = bestOption.costAmount ?? parseCostAmount(bestOption.cost);

    if (bestCost != null) {
        let maxOtherCost = 0;
        for (const o of others) {
            const oCost = o.costAmount ?? parseCostAmount(o.cost);
            if (oCost != null && oCost > maxOtherCost) maxOtherCost = oCost;
        }
        const saved = maxOtherCost - bestCost;
        if (bestCost === 0) {
            reasons.push("Zero cost — completely free");
        } else if (saved >= 20) {
            reasons.push("Saves \u20B9" + saved + " compared to alternatives");
        } else if (saved > 0) {
            reasons.push("Cost efficient");
        }
    }

    // ── 3. AQI / Air quality ───────────────────────────────────────
    if (weather?.aqi) {
        const aqiInfo = AQI_LABELS[weather.aqi] || null;
        if (bestOption.mode === "walk" && aqiInfo?.outdoor) {
            reasons.push("Good air quality for outdoor travel (AQI: " + (weather.aqiLabel || aqiInfo.label) + ")");
        } else if (bestOption.mode === "walk" && aqiInfo && !aqiInfo.outdoor) {
            // Walking in bad AQI — this would be a caveat, not a positive
            // Skip adding as a reason (it's a minus)
        } else if ((bestOption.mode === "metro" || bestOption.mode === "train") && aqiInfo && !aqiInfo.outdoor) {
            reasons.push("Better air quality — enclosed transit avoids outdoor pollution (AQI: " + (weather.aqiLabel || aqiInfo.label) + ")");
        } else if (bestOption.mode === "cab" && aqiInfo && !aqiInfo.outdoor) {
            reasons.push("AC cab shields from poor outdoor air quality");
        }
    }

    // ── 4. Peak Hour Status ────────────────────────────────────────
    const peak = isPeakHour();
    if (peak) {
        if (bestOption.mode === "metro" || bestOption.mode === "train") {
            reasons.push("Avoids road traffic during peak hours");
        } else if (bestOption.mode === "walk" && bestMin != null && bestMin <= 20) {
            reasons.push("Walking avoids peak-hour road congestion");
        }
    } else {
        if (bestOption.mode === "cab") {
            reasons.push("Off-peak traffic — smooth cab ride");
        }
    }

    if (peak && !bestOption.peakWarning) {
        reasons.push("No peak-hour delays on this mode");
    }

    // ── 5. Crowd Level ─────────────────────────────────────────────
    if (bestOption.crowdLevel) {
        if (bestOption.crowdLevel === "low") {
            reasons.push("Less crowded — comfortable journey");
        } else if (bestOption.crowdLevel === "moderate") {
            reasons.push("Moderate crowd levels");
        }
    }

    // ── 6. Safety Score ────────────────────────────────────────────
    if (bestOption.safetyScore != null) {
        const otherSafety = others.map((o) => o.safetyScore).filter((s) => s != null);
        const avgOtherSafety = otherSafety.length > 0
            ? otherSafety.reduce((a, b) => a + b, 0) / otherSafety.length
            : 0;

        if (bestOption.safetyScore >= 8) {
            reasons.push("High safety score (" + bestOption.safetyScore + "/10)");
        } else if (bestOption.safetyScore > avgOtherSafety + 1) {
            reasons.push("Safer route than alternatives");
        }
    }

    // ── 7. Personalization Context ─────────────────────────────────
    const preferredModes = preferences?.preferred_modes || null;
    const hasPersonalization =
        (preferredModes && Object.keys(preferredModes).length > 0) ||
        preferences?.avg_budget != null;

    if (hasPersonalization) {
        const modeWeight = getPreferredModeWeight(preferredModes, bestOption.mode);
        const budget = preferences?.avg_budget;

        if (modeWeight >= 0.2) {
            reasons.unshift(
                "Based on your past behavior, you usually prefer " +
                (bestOption.label || bestOption.mode) + " routes."
            );
        } else if (budget != null && bestCost != null && bestCost <= budget) {
            reasons.unshift(
                "Based on your past behavior, this option fits your usual budget (~₹" +
                Math.round(budget) + ")."
            );
        } else {
            reasons.unshift("Based on your past behavior, this option aligns with your typical travel patterns.");
        }
    }

    // ── 8. Rain awareness ──────────────────────────────────────────
    if (weather?.rainProbability > 50) {
        if (bestOption.mode === "cab" || bestOption.mode === "metro" || bestOption.mode === "train") {
            reasons.push("Sheltered from " + weather.rainProbability + "% rain probability");
        }
    }

    // Fallback: ensure at least one reason
    if (reasons.length === 0) {
        reasons.push("Best overall balance of time, cost, and comfort");
    }

    // Build summary
    const summary = reasons.slice(0, 2).join(" · ");

    return { reasons, summary };
}
