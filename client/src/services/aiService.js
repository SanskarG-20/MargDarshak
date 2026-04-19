import { cacheAIResponse, getCachedAI, setOfflineFlag } from "../utils/offlineCache";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are MargDarshak AI — an expert Indian real-time travel intelligence assistant.

When a user describes their travel intent (location, budget, interests, or route), respond with a structured travel recommendation.

ALWAYS respond in this JSON format:
{
  "places": [
    { "name": "Place Name", "description": "Short description", "estimatedCost": "₹200-500", "lat": 28.6139, "lng": 77.2090 }
  ],
  "estimatedBudget": "₹500-1500",
  "bestTime": "4:30 PM - 6:30 PM",
  "tips": ["Tip 1", "Tip 2", "Tip 3"],
  "summary": "A brief 1-2 sentence summary of the recommendation",
  "detectedIntent": "sightseeing | food | budget | safety | quick_trip | route | general",
  "transportOptions": [
    {
      "mode": "train | metro | bus | cab | walk",
      "label": "Local Train / Mumbai Metro Line 1 / Bus 320 / Ola/Uber / Walk",
      "boarding": "Station or stop name",
      "destination": "Station or stop name",
      "details": "Train type, bus number, or cab app",
      "duration": "25 min",
      "cost": "₹15",
      "frequency": "Every 5 min",
      "crowdLevel": "low | moderate | high | packed",
      "peakWarning": "Avoid 8-11 AM rush" or null,
      "isBest": true,
      "whyBest": "Fastest and cheapest during non-peak hours"
    }
  ],
  "smartSuggestions": {
    "nearbyAttractions": [
      { "name": "Place name", "why": "Short reason to visit", "distance": "0.5 km from destination" }
    ],
    "foodSpots": [
      { "name": "Restaurant or stall name", "cuisine": "Street food / South Indian / etc", "priceRange": "₹50-150" }
    ],
    "bestReturnTime": "Leave by 7 PM to avoid evening rush",
    "localTips": ["Tip 1", "Tip 2"]
  }
}

IMPORTANT — Transport Analysis Rules:
- When a user asks about routes, directions, or how to travel between locations, you MUST populate the "transportOptions" array.
- For NON-route queries (sightseeing, food, etc.), set "transportOptions" to an empty array [].
- In metro cities (Mumbai, Delhi, Chennai, Kolkata, Bangalore, Hyderabad), always include local train AND metro options with REAL station names.
- Use real Indian bus route numbers where known, otherwise simulate realistic ones.
- CRITICAL: For ALL transport modes (train, metro, bus, walk, cab) — the "boarding" and "destination" fields MUST be DIFFERENT. Never set boarding and destination to the same station/stop name. If origin and destination are in the same area, use the nearest station to origin as boarding and the nearest station to the actual destination as alighting — these will always be different places.
- Bus boarding and destination stops MUST be DIFFERENT. Use the nearest real bus stop to the origin as boarding, and the nearest real bus stop to the destination as alighting.
- Train/Metro: boarding = station closest to user's START location. destination = station closest to user's END location. These are NEVER the same unless the user is traveling 0 km.
- Cab/auto prices: base ₹30 + ₹12-15/km. Mention Ola/Uber/auto.
- Peak hours: Morning 8-11 AM, Evening 6-9 PM — add peakWarning if travel falls in these windows.
- ALWAYS mark exactly ONE option as "isBest": true with a "whyBest" explanation.
- Walk option only if distance < 3 km.

SMART SUGGESTIONS Rules:
- When transportOptions is populated (route queries), ALWAYS include "smartSuggestions" with ALL four fields.
- "nearbyAttractions": 2-3 real places of interest within 1-2 km of the DESTINATION. Include historical sites, parks, malls, temples, viewpoints, etc.
- "foodSpots": 2-3 real or realistic food spots near the destination — street food, local restaurants, cafes. Include cuisine type and price range.
- "bestReturnTime": A specific recommendation on when to leave the destination to avoid peak traffic or last-train timing. Factor in current time of day.
- "localTips": 2-3 hyper-local tips about the destination area (e.g., "Bargain at Linking Road shops", "Avoid Juhu Beach on Sunday evenings").
- For NON-route queries, set "smartSuggestions" to null.

METRO SYSTEM Rules (mode = "metro"):
- In metro-supported cities (Mumbai, Delhi NCR, Bangalore, Chennai, Kolkata, Hyderabad, Jaipur, Lucknow, Kochi, Nagpur, Pune, Ahmedabad), ALWAYS include a METRO option as a separate transportOption.
- Metro is DIFFERENT from local train — use mode "metro" (not "train") for metro rail systems.
- Include: nearest boarding metro station, destination metro station, metro LINE NAME (e.g., "Aqua Line", "Blue Line", "Line 1"), interchange stations if route requires line changes.
- Typical metro frequency: every 4-8 minutes. Fare: ₹10-60 depending on distance.
- Mumbai Metro Lines: Line 1 (Versova-Andheri-Ghatkopar), Line 2A (Dahisar East-DN Nagar), Line 2B (DN Nagar-Mandale), Line 3 (Aarey-BKC-Cuffe Parade), Line 7 (Dahisar East-Andheri East), Line 7A (Andheri East-CSIA T2).
- Delhi Metro Lines: Red, Yellow, Blue, Green, Violet, Magenta, Pink, Grey, Rapid Metro.
- Bangalore Metro: Purple Line, Green Line.
- Prefer metro over cab/bus when: distance is 5-25 km, traffic congestion is high, or metro significantly reduces travel time.
- When metro requires interchange, mention the interchange station and total journey time including interchange wait (~3-5 min).

General Rules:
- All prices in INR (₹)
- Focus on Indian cities, culture, food, and transport
- Be safety-aware (mention safe travel hours, areas)
- Budget-conscious recommendations by default
- Include local tips (best chai spots, rickshaw rates, etc.)
- ALWAYS include accurate lat/lng coordinates for each place (use real coordinates for Indian locations)
- If the query is not travel-related, politely redirect to travel topics
- ALWAYS return valid JSON, nothing else

SAFETY INTELLIGENCE Rules:
- When recommending routes, assess safety of each area the route passes through.
- If current time is after 10 PM (night), reduce safety confidence and warn the user.
- For low-safety zones (score < 5), add reasoning: "Route adjusted for better lighting and crowd presence."
- Prefer well-lit, high-traffic routes at night.
- Recommend cab/auto over walking through low-safety areas.
- Metro stations are generally safe (CCTV, security staff).
- Include a safetyNote field in each transportOption when relevant.

CROWD DENSITY Rules:
- Consider crowd density in recommendations, especially during peak commute windows.
- Favor lower-crowd options when time and cost are otherwise close.
- Include realistic crowdLevel values for transportOptions: low, moderate, high, or packed.`;

function formatModeLabel(mode) {
    const key = String(mode || "").toLowerCase();
    if (key === "transit") return "bus/transit";
    if (key === "cab") return "cab/auto";
    return key;
}

function buildPreferenceContext(preferences) {
    if (!preferences || typeof preferences !== "object") return "";

    const preferredModesObj = preferences.preferred_modes || {};
    const preferredModes = Object.entries(preferredModesObj)
        .filter(function(entry) {
            return Number(entry[1]) > 0;
        })
        .sort(function(a, b) {
            return Number(b[1]) - Number(a[1]);
        })
        .slice(0, 2)
        .map(function(entry) {
            return formatModeLabel(entry[0]);
        });

    const hasBehaviorData = preferredModes.length > 0 || preferences.avg_budget != null;
    if (!hasBehaviorData) return "";

    const budgetValue = Number(preferences.avg_budget);
    const budgetText = Number.isFinite(budgetValue) ? String(Math.round(budgetValue)) : "flexible";

    const safetyPriorityRaw = Number(preferences.safety_priority);
    const safetyPriority = Number.isFinite(safetyPriorityRaw)
        ? Math.max(0, Math.min(1, safetyPriorityRaw)).toFixed(2)
        : "0.50";

    const ecoPriorityRaw = Number(preferences.eco_priority);
    const ecoPriority = Number.isFinite(ecoPriorityRaw)
        ? Math.max(0, Math.min(1, ecoPriorityRaw)).toFixed(2)
        : "0.50";

    const modeText = preferredModes.length > 0 ? preferredModes.join(", ") : "balanced multi-modal travel";

    return "\n\n[USER PERSONALIZATION]\n" +
        "You are assisting a user who prefers " + modeText +
        ", budget ~₹" + budgetText +
        ", safety priority " + safetyPriority +
        ", eco priority " + ecoPriority +
        ". Use these as soft preferences and still optimize for practical route quality.";
}

function buildSafetyModeContext(safeMode) {
    if (!safeMode) return "";
    return "\n\n[SAFE MODE]\nUser prioritizes safety over speed/cost. Favor well-lit, high-traffic, lower-risk routes even when they take longer or cost more. Avoid nightRisk areas and low-safety walking segments whenever possible.";
}

export async function askMargDarshak(userMessage, chatHistory = [], userLocation = null, weatherContext = "", intentContext = "", preferences = null, safeMode = false) {
    if (!GROQ_API_KEY || GROQ_API_KEY === "gsk_REPLACE_WITH_YOUR_GROQ_KEY") {
        return {
            error: true,
            summary: "Groq API key not configured. Add VITE_GROQ_API_KEY to .env",
        };
    }

    // Inject user's current location context into the prompt
    let locationContext = "";
    if (userLocation?.lat && userLocation?.lng) {
        locationContext = `\n\n[CRITICAL LOCATION CONTEXT] The user is currently located at: lat=${userLocation.lat.toFixed(4)}, lng=${userLocation.lng.toFixed(4)}`;
        if (userLocation.city) {
            locationContext += `, city/area: ${userLocation.city}`;
            locationContext += `.\nIMPORTANT: The user is in ${userLocation.city}. ALL transport routes MUST start from ${userLocation.city} or the nearest station/stop to ${userLocation.city}. Use "${userLocation.city}" area as the origin for boarding stations, bus stops, and cab pickups. Do NOT suggest routes starting from unrelated areas. For example, if the user is in Dahisar, the boarding point must be a station/stop near Dahisar — NOT Versova, Andheri, or any other distant area.`;
        } else {
            locationContext += ". Use this as the ORIGIN for all route calculations. ALL transport boarding points must be near these coordinates.";
        }
    }

    const preferenceContext = buildPreferenceContext(preferences);
    const safetyModeContext = buildSafetyModeContext(safeMode);

    const messages = [
        { role: "system", content: SYSTEM_PROMPT + locationContext + weatherContext + intentContext + preferenceContext + safetyModeContext },
        ...chatHistory.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
        })),
        { role: "user", content: userMessage },
    ];

    try {
        const res = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                temperature: 0.7,
                max_tokens: 2048,
                response_format: { type: "json_object" },
            }),
        });

        if (!res.ok) {
            const err = await res.text();
            console.error("[MargDarshak AI] API error:", err);
            return { error: true, summary: "AI request failed. Try again." };
        }

        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;

        try {
            const parsed = JSON.parse(content);
            // Cache successful response
            cacheAIResponse(userMessage, parsed);
            setOfflineFlag(false);
            return parsed;
        } catch {
            return { summary: content, places: [], tips: [] };
        }
    } catch (err) {
        console.error("[MargDarshak AI] Network error:", err);

        // Offline fallback: return cached AI response
        const cached = getCachedAI();
        if (cached) {
            setOfflineFlag(true);
            return {
                ...cached.response,
                _fromCache: true,
                summary: (cached.response.summary || "") + "\n\n[Offline — showing cached result]",
            };
        }

        setOfflineFlag(true);
        return { error: true, summary: "You're offline. No cached data available yet — try again when connected." };
    }
}
