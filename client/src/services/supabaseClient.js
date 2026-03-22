import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseReady =
    !!SUPABASE_URL &&
    !!SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "https://YOUR-PROJECT.supabase.co";

if (!supabaseReady) {
    console.warn(
        "[MargDarshak] Missing Supabase credentials — database features disabled. Add your keys to client/.env"
    );
}

export const supabase = supabaseReady
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export { supabaseReady };

/**
 * Upsert a Clerk user into the Supabase `users` table.
 * If clerk_id already exists, updates email/name/avatar.
 * If not, creates a new row.
 */
export async function syncUserWithDatabase(userData) {
    if (!supabase) {
        console.log("[MargDarshak] Supabase not configured — skipping user sync");
        return null;
    }

    const { data, error } = await supabase
        .from("users")
        .upsert(
            {
                clerk_id: userData.clerkId,
                email: userData.email,
                full_name: userData.fullName,
                avatar_url: userData.avatarUrl,
                phone: userData.phone,
            },
            { onConflict: "clerk_id" }
        )
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] User sync failed:", error.message);
        return null;
    }

    console.log("[MargDarshak] User synced to Supabase:", data.id);
    return data;
}

/**
 * Get user row by Clerk ID.
 */
export async function getUserByClerkId(clerkId) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("clerk_id", clerkId)
        .single();

    if (error) return null;
    return data;
}

/**
 * Create a new trip for the given Supabase user ID.
 */
export async function createTrip({ userId, intent, origin, destination }) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("trips")
        .insert({ user_id: userId, intent, origin, destination })
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] Trip creation failed:", error.message);
        return null;
    }
    return data;
}

/**
 * Save an AI prompt/response pair for the given Supabase user ID.
 */
export async function saveAIHistory({ userId, prompt, response }) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("ai_history")
        .insert({ user_id: userId, prompt, response })
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] AI history save failed:", error.message);
        return null;
    }
    return data;
}

/**
 * Save user's detected/manual location to Supabase users table.
 */
export async function saveUserLocation({ userId, lat, lng, city }) {
    if (!supabase) return null;

    const updates = {};
    if (lat != null) updates.last_lat = lat;
    if (lng != null) updates.last_lng = lng;
    if (city) updates.last_city = city;

    if (Object.keys(updates).length === 0) return null;

    const { data, error } = await supabase
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] Location save failed:", error.message);
        return null;
    }
    console.log("[MargDarshak] Location saved:", city || `${lat},${lng}`);
    return data;
}

/**
 * Save a user intent (travel query).
 */
export async function saveIntent({ userId, query }) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("intents")
        .insert({ user_id: userId, query })
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] Intent save failed:", error.message);
        return null;
    }
    return data;
}

/**
 * Get AI chat history for a user, oldest first (for chat display).
 * Returns the most recent 20 conversations.
 */
export async function getAIHistory(userId, limit = 20) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from("ai_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("[MargDarshak] Fetch AI history failed:", error.message);
        return [];
    }
    // Return in chronological order for chat display
    return (data || []).reverse();
}

/**
 * Get all intents for a user, newest first.
 */
export async function getIntents(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from("intents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[MargDarshak] Fetch intents failed:", error.message);
        return [];
    }
    return data;
}

/**
 * Save an environment log snapshot (weather + AQI).
 */
export async function saveEnvironmentLog({ userId, temperature, weather, weatherCode, aqi, aqiLabel, humidity, windSpeed, rainProbability, pm25 }) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("environment_logs")
        .insert({
            user_id: userId,
            temp: temperature,
            weather: weather,
            weather_code: weatherCode,
            aqi: aqi,
            aqi_label: aqiLabel,
            humidity: humidity,
            wind_speed: windSpeed,
            rain_probability: rainProbability,
            pm25: pm25,
        })
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] Environment log save failed:", error.message);
        return null;
    }
    return data;
}

/* ── Saved Trips ─────────────────────────────── */

/**
 * Save a trip (source + destination + preferred mode).
 */
export async function saveTrip({ userId, source, destination, preferredMode }) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("saved_trips")
        .insert({
            user_id: userId,
            source,
            destination,
            preferred_mode: preferredMode || null,
        })
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] Save trip failed:", error.message);
        return null;
    }
    return data;
}

/**
 * Get all saved trips for a user, newest first.
 */
export async function getSavedTrips(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from("saved_trips")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[MargDarshak] Fetch saved trips failed:", error.message);
        return [];
    }
    return data || [];
}

/**
 * Delete a saved trip by ID.
 */
export async function deleteSavedTrip(tripId) {
    if (!supabase) return false;

    const { error } = await supabase
        .from("saved_trips")
        .delete()
        .eq("id", tripId);

    if (error) {
        console.error("[MargDarshak] Delete saved trip failed:", error.message);
        return false;
    }
    return true;
}

/* ── SOS Emergency Logs ────────────────────────────── */

/**
 * Log an SOS trigger event to Supabase.
 * Fire-and-forget — errors are silently logged.
 */
export async function logSOSTrigger({ userId, lat, lng, area }) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from("sos_logs")
        .insert({
            user_id: userId,
            lat: lat || null,
            lng: lng || null,
            area: area || null,
        })
        .select()
        .single();

    if (error) {
        console.error("[MargDarshak] SOS log failed:", error.message);
        return null;
    }
    return data;
}

/* ── Community Safety Reports ───────────────────── */

export async function submitSafetyReport({ userId, lat, lng, category, description, severity }) {
    if (!supabase) {
        return { data: null, error: { message: "Supabase not configured" } };
    }

    const { data, error } = await supabase
        .from("safety_reports")
        .insert({
            user_id: userId,
            lat,
            lng,
            category,
            description: description || null,
            severity,
        })
        .select();

    return { data, error };
}

export async function getActiveSafetyReports() {
    if (!supabase) {
        return { data: [], error: { message: "Supabase not configured" } };
    }

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from("safety_reports")
        .select("*")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(100);

    return { data: data || [], error };
}

export async function deleteSafetyReport(reportId, userId) {
    if (!supabase) {
        return { data: null, error: { message: "Supabase not configured" } };
    }

    const { data, error } = await supabase
        .from("safety_reports")
        .delete()
        .eq("id", reportId)
        .eq("user_id", userId)
        .select();

    return { data, error };
}
