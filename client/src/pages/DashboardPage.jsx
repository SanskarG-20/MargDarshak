import { UserButton, useUser } from "@clerk/clerk-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Y, BK, WH } from "../constants/theme";
import { useJourney } from "../context/JourneyContext";
import useUserSync from "../hooks/useUserSync";
import useGeolocation from "../hooks/useGeolocation";
import { saveUserLocation } from "../services/supabaseClient";
import { fetchWeatherAndAQI, buildWeatherContext } from "../services/weatherService";
import { saveEnvironmentLog } from "../services/supabaseClient";
import { getUserPreferences, updatePreferencesFromHistory } from "../services/personalizationService";
import {
    detectDelays,
    monitorRouteDeviation,
    suggestBetterRoute,
} from "../services/liveRoutingService";
import { isOfflineFlagSet } from "../utils/offlineCache";
import Cursor from "../components/Cursor";
import LocationBar from "../components/LocationBar";
import WeatherBadge from "../components/WeatherBadge";
import IntentInput from "../components/IntentInput";
import AIChat from "../components/AIChat";
import SavedRoutes from "../components/SavedRoutes";
import MapView from "../components/MapView";
import RoutePanel from "../components/RoutePanel";
import SOSButton from "../components/SOSButton";
import OnboardingTour from "../components/OnboardingTour";
import useOnboardingTour, { TOUR_STEPS } from "../hooks/useOnboardingTour";

export default function DashboardPage() {
    const { user, isLoaded } = useUser();
    const { currentJourney, setCurrentJourney } = useJourney();
    const { dbUser } = useUserSync();
    const { location: userLocation, city, loading: geoLoading, permissionDenied, setManualCity } = useGeolocation();
    const [liveJourneyLocation, setLiveJourneyLocation] = useState(null);
    const [aiActive, setAiActive] = useState(false);
    const [mapActive, setMapActive] = useState(false);
    const [mapMarkers, setMapMarkers] = useState([]);
    const [weather, setWeather] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const [routeGeometry, setRouteGeometry] = useState([]);
    const [routeActive, setRouteActive] = useState(false);
    const [showAQI, setShowAQI] = useState(false);
    const [pendingQuery, setPendingQuery] = useState(null);
    const [offline, setOffline] = useState(!navigator.onLine);
    const [usePreferences, setUsePreferences] = useState(true);
    const [preferences, setPreferences] = useState(null);
    const [prefLoading, setPrefLoading] = useState(false);
    const [rerouteSuggestion, setRerouteSuggestion] = useState(null);
    const { tourActive, currentStep, totalSteps, next, skip } = useOnboardingTour();
    const lastLiveCheckRef = useRef(0);
    const lastSuggestionRef = useRef(0);
    const suggestionSignatureRef = useRef("");
    const liveMonitorBusyRef = useRef(false);
    const currentJourneyRef = useRef(currentJourney);
    const rerouteSuggestionRef = useRef(rerouteSuggestion);
    const preferencesRef = useRef(preferences);
    const usePreferencesRef = useRef(usePreferences);
    const effectiveUserLocation = liveJourneyLocation || userLocation;

    useEffect(() => {
        currentJourneyRef.current = currentJourney;
    }, [currentJourney]);

    useEffect(() => {
        rerouteSuggestionRef.current = rerouteSuggestion;
    }, [rerouteSuggestion]);

    useEffect(() => {
        preferencesRef.current = preferences;
    }, [preferences]);

    useEffect(() => {
        usePreferencesRef.current = usePreferences;
    }, [usePreferences]);

    // Detect browser online/offline events + check cache flag after AI calls
    useEffect(() => {
        const goOffline = () => setOffline(true);
        const goOnline = () => {
            setOffline(false);
            // Clear the cache offline flag immediately
            try { localStorage.removeItem("md_offline_active"); } catch {}
        };
        window.addEventListener("offline", goOffline);
        window.addEventListener("online", goOnline);

        // Poll the cache offline flag (set by services on API failure)
        const interval = setInterval(() => {
            setOffline((prev) => {
                const flag = isOfflineFlagSet();
                return !navigator.onLine || flag;
            });
        }, 3000);

        return () => {
            window.removeEventListener("offline", goOffline);
            window.removeEventListener("online", goOnline);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!currentJourney?.destination?.lat || !navigator.geolocation) return undefined;

        const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const now = Date.now();
                if (now - lastLiveCheckRef.current < 8000) return;
                lastLiveCheckRef.current = now;

                const position = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                };

                setLiveJourneyLocation(position);
                setCurrentJourney((prev) => prev ? {
                    ...prev,
                    lastKnownPosition: position,
                } : prev);

                if (liveMonitorBusyRef.current) return;
                if (rerouteSuggestionRef.current) return;

                liveMonitorBusyRef.current = true;
                try {
                    const activeJourney = currentJourneyRef.current;
                    if (!activeJourney?.destination?.lat) return;

                    const journeySnapshot = {
                        ...activeJourney,
                        lastKnownPosition: position,
                    };

                    const deviation = monitorRouteDeviation(position, journeySnapshot);
                    const delay = await detectDelays(journeySnapshot, position);
                    const shouldRecalculate = deviation.shouldRecalculate || delay.shouldRecalculate;

                    if (!shouldRecalculate) return;
                    if (now - lastSuggestionRef.current < 45000) return;

                    const suggestion = await suggestBetterRoute(
                        position,
                        journeySnapshot,
                        usePreferencesRef.current ? preferencesRef.current : null
                    );

                    if (!suggestion) return;

                    const signature = [
                        suggestion.nextBest?.mode,
                        suggestion.improvement?.minutes,
                        suggestion.improvement?.cost,
                        Math.round(position.lat * 1000),
                        Math.round(position.lng * 1000),
                    ].join(":");

                    if (signature === suggestionSignatureRef.current) return;

                    suggestionSignatureRef.current = signature;
                    lastSuggestionRef.current = now;
                    setRerouteSuggestion({
                        ...suggestion,
                        triggerReason: deviation.reason || delay.reason || "Route conditions changed.",
                    });
                } finally {
                    liveMonitorBusyRef.current = false;
                }
            },
            (err) => {
                console.warn("[MargDarshak Live Routing] watchPosition failed:", err.message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 12000,
            }
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, [
        currentJourney?.destination?.lat,
        currentJourney?.destination?.lng,
        setCurrentJourney,
    ]);

    useEffect(() => {
        if (currentJourney) return;
        setLiveJourneyLocation(null);
        setRerouteSuggestion(null);
        suggestionSignatureRef.current = "";
    }, [currentJourney]);

    // Save location to Supabase whenever it changes
    useEffect(() => {
        if (dbUser?.id && effectiveUserLocation?.lat && effectiveUserLocation?.lng) {
            saveUserLocation({
                userId: dbUser.id,
                lat: effectiveUserLocation.lat,
                lng: effectiveUserLocation.lng,
                city: city || null,
            });
        }
    }, [dbUser?.id, effectiveUserLocation?.lat, effectiveUserLocation?.lng, city]);

    // Fetch weather + AQI when location is available
    useEffect(() => {
        if (!effectiveUserLocation?.lat || !effectiveUserLocation?.lng) return;

        setWeatherLoading(true);
        fetchWeatherAndAQI(effectiveUserLocation.lat, effectiveUserLocation.lng)
            .then((data) => {
                if (data) {
                    setWeather(data);
                    // Log environment snapshot to Supabase
                    if (dbUser?.id) {
                        saveEnvironmentLog({
                            userId: dbUser.id,
                            temperature: data.temperature,
                            weather: data.weatherLabel,
                            weatherCode: data.weatherCode,
                            aqi: data.aqi,
                            aqiLabel: data.aqiLabel,
                            humidity: data.humidity,
                            windSpeed: data.windSpeed,
                            rainProbability: data.rainProbability,
                            pm25: data.pm25,
                        }).catch(() => {}); // non-blocking
                    }
                }
            })
            .finally(() => setWeatherLoading(false));
    }, [effectiveUserLocation?.lat, effectiveUserLocation?.lng, dbUser?.id]);

    // Build location context object for AI
    const aiLocationContext = useMemo(() => {
        if (!effectiveUserLocation) return null;
        return { lat: effectiveUserLocation.lat, lng: effectiveUserLocation.lng, city: city || null };
    }, [effectiveUserLocation, city]);

    // Build weather context string for AI
    const weatherCtx = useMemo(() => buildWeatherContext(weather), [weather]);

    const handleSavedRouteSelect = useCallback((source, destination) => {
        setPendingQuery({ text: `Best route from ${source} to ${destination}`, ts: Date.now() });
    }, []);

    const refreshPreferences = useCallback(async () => {
        if (!dbUser?.id) {
            setPreferences(null);
            return;
        }

        setPrefLoading(true);
        try {
            const updated = await updatePreferencesFromHistory(dbUser.id);
            if (updated) {
                setPreferences(updated);
            } else {
                const existing = await getUserPreferences(dbUser.id);
                setPreferences(existing);
            }
        } catch (err) {
            console.warn("[MargDarshak Personalization] Preference refresh failed:", err);
            const existing = await getUserPreferences(dbUser.id);
            setPreferences(existing);
        } finally {
            setPrefLoading(false);
        }
    }, [dbUser?.id]);

    useEffect(() => {
        refreshPreferences();
    }, [refreshPreferences]);

    const handleAIResponse = useCallback((parsedResult) => {
        setAiActive(true);
        // Extract places with coordinates from AI response for map markers
        if (parsedResult?.places?.length > 0) {
            const newMarkers = parsedResult.places
                .filter((p) => p.lat && p.lng)
                .map((p) => ({
                    name: p.name,
                    lat: p.lat,
                    lng: p.lng,
                    description: p.description,
                    estimatedCost: p.estimatedCost,
                }));
            if (newMarkers.length > 0) {
                setMapMarkers(newMarkers);
            }
        }
    }, []);

    const handleRouteCalculated = useCallback((journey) => {
        if (journey?.geometry?.length > 0) {
            setRouteGeometry(journey.geometry);
        } else {
            setRouteGeometry([]);
        }
        setRouteActive(true);
    }, []);

    useEffect(() => {
        if (!currentJourney) return;

        if (currentJourney.geometry?.length > 0) {
            setRouteGeometry(currentJourney.geometry);
        } else {
            setRouteGeometry([]);
        }
        setRouteActive(true);
    }, [currentJourney]);

    const handleAcceptReroute = useCallback(() => {
        if (!rerouteSuggestion?.journey) return;

        setCurrentJourney(rerouteSuggestion.journey);
        setRouteGeometry(rerouteSuggestion.journey.geometry || []);
        setRouteActive(true);
        setRerouteSuggestion(null);
        suggestionSignatureRef.current = "";
    }, [rerouteSuggestion, setCurrentJourney]);

    const handleDismissReroute = useCallback(() => {
        setRerouteSuggestion(null);
        lastSuggestionRef.current = Date.now();
    }, []);

    if (!isLoaded) {
        return (
            <div
                className="dark-page"
                style={{
                    minHeight: "100vh",
                    background: BK,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 24,
                        color: Y,
                        letterSpacing: 3,
                        animation: "pulse-ring 2s ease-out infinite",
                    }}
                >
                    LOADING...
                </div>
            </div>
        );
    }

    return (
        <div
            className="dark-page"
            style={{
                minHeight: "100vh",
                background: BK,
                padding: "80px 16px 60px",
            }}
        >
            <Cursor />

            {/* OFFLINE MODE BADGE */}
            {offline && (
                <div style={{
                    position: "fixed",
                    top: 14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 200,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 18px",
                    background: "rgba(239,68,68,.12)",
                    border: "1px solid rgba(239,68,68,.3)",
                    backdropFilter: "blur(8px)",
                    animation: "ldm-step-in 0.3s ease both",
                }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#ef4444",
                        boxShadow: "0 0 8px #ef4444",
                        animation: "pulse-ring 1.5s ease infinite",
                        display: "inline-block",
                    }} />
                    <span style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: 13,
                        letterSpacing: 2,
                        color: "#ef4444",
                    }}>
                        OFFLINE MODE ACTIVE
                    </span>
                </div>
            )}

            {/* ── Animated background ── */}
            <div className="dark-page-bg">
                <div className="dark-page-bg__gradient" />
                <div className="dark-page-bg__noise" />
                <div className="dark-page-bg__orb dark-page-bg__orb--1" />
                <div className="dark-page-bg__orb dark-page-bg__orb--2" />
                <div className="dark-page-bg__orb dark-page-bg__orb--3" />
                <div className="dark-page-bg__scan" />

                {/* Grid overlay */}
                <svg
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        opacity: 0.06,
                    }}
                >
                    <defs>
                        <pattern
                            id="dash-grid"
                            x="0"
                            y="0"
                            width="60"
                            height="60"
                            patternUnits="userSpaceOnUse"
                        >
                            <path
                                d="M 60 0 L 0 0 0 60"
                                fill="none"
                                stroke={Y}
                                strokeWidth="0.5"
                            />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dash-grid)" />
                </svg>

                <div className="dark-page-bg__vignette" />
            </div>

            {/* Watermark */}
            <div
                style={{
                    position: "fixed",
                    bottom: -30,
                    right: -20,
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: "clamp(120px, 20vw, 260px)",
                    color: "rgba(204,255,0,.04)",
                    letterSpacing: -5,
                    userSelect: "none",
                    pointerEvents: "none",
                    zIndex: 0,
                    lineHeight: 0.85,
                }}
            >
                MARG
                <br />
                DARSHAK
            </div>

            {/* Yellow top stripe */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: Y,
                    zIndex: 100,
                }}
            />

            {/* Bottom-right accent bar */}
            <div
                style={{
                    position: "fixed",
                    bottom: 0,
                    right: 0,
                    width: "35%",
                    height: 4,
                    background: Y,
                    zIndex: 100,
                }}
            />

            <div style={{ maxWidth: 800, margin: "0 auto", position: "relative", zIndex: 1, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 40,
                    }}
                >
                    <a
                        href="/"
                        style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 28,
                            color: Y,
                            letterSpacing: 3,
                            textDecoration: "none",
                            lineHeight: 1,
                        }}
                    >
                        MARG
                        <br />
                        DARSHAK
                    </a>
                    <UserButton
                        appearance={{
                            elements: {
                                avatarBox: {
                                    width: 40,
                                    height: 40,
                                    border: `2px solid ${Y}`,
                                },
                            },
                        }}
                    />
                </div>

                {/* Greeting */}
                <div
                    style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: 13,
                        color: Y,
                        letterSpacing: 4,
                        marginBottom: 16,
                        textTransform: "uppercase",
                    }}
                >
          // WELCOME BACK
                </div>
                <h1
                    style={{
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: "clamp(48px,8vw,96px)",
                        color: WH,
                        lineHeight: 0.9,
                        marginBottom: 32,
                    }}
                >
                    NAMASTE,
                    <br />
                    <span style={{ color: Y }}>
                        {user?.firstName || user?.username || "TRAVELER"}
                    </span>
                    <span style={{ color: "rgba(255,255,255,.2)" }}>.</span>
                </h1>

                {/* Dashboard welcome */}
                <div
                    style={{
                        border: `2px solid rgba(255,255,255,.1)`,
                        borderLeft: `5px solid ${Y}`,
                        padding: "24px 18px",
                        marginBottom: 24,
                    }}
                >
                    <div
                        style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 22,
                            color: Y,
                            letterSpacing: 2,
                            marginBottom: 12,
                        }}
                    >
                        WELCOME, {user?.firstName?.toUpperCase() || "TRAVELLER"}
                    </div>
                    <div
                        style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontSize: 14,
                            color: "rgba(255,255,255,.5)",
                            lineHeight: 1.7,
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px 16px",
                        }}
                    >
                        {[
                            { icon: "\u2728", text: "AI Travel Chat" },
                            { icon: "\uD83D\uDCCD", text: "Live Location" },
                            { icon: "\u26C5", text: "Weather & AQI" },
                            { icon: "\uD83D\uDEE4\uFE0F", text: "Route Intelligence" },
                            { icon: "\uD83D\uDDFA\uFE0F", text: "Interactive Maps" },
                            { icon: "\uD83D\uDE82", text: "Local Train" },
                        ].map((f) => (
                            <span key={f.text} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <span>{f.icon}</span> {f.text}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Location Bar */}
                <LocationBar
                    location={effectiveUserLocation}
                    city={city}
                    loading={geoLoading}
                    permissionDenied={permissionDenied}
                    onManualCity={setManualCity}
                />

                {/* Weather Badge */}
                <WeatherBadge
                    weather={weather}
                    loading={weatherLoading}
                    city={city}
                />

                {/* Intent Input */}
                <IntentInput dbUser={dbUser} />

                {/* Saved Routes */}
                <SavedRoutes
                    dbUser={dbUser}
                    onSelectRoute={handleSavedRouteSelect}
                />

                {/* AI Chat */}
                <AIChat
                    dbUser={dbUser}
                    onAIResponse={handleAIResponse}
                    userLocation={aiLocationContext}
                    weatherContext={weatherCtx}
                    weather={weather}
                    pendingQuery={pendingQuery}
                    usePreferences={usePreferences}
                    preferences={preferences}
                    onBehaviorTracked={refreshPreferences}
                />

                <div
                    style={{
                        marginTop: 10,
                        marginBottom: 18,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                        padding: "10px 12px",
                        border: "1px solid rgba(255,255,255,.08)",
                        background: "rgba(255,255,255,.02)",
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 14,
                            letterSpacing: 1.5,
                            color: Y,
                        }}>
                            USE MY PREFERENCES
                        </span>
                        <span style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontSize: 11,
                            color: "rgba(255,255,255,.45)",
                        }}>
                            {prefLoading
                                ? "Learning from your recent behavior..."
                                : preferences
                                    ? `Routes and explanations adapt to your travel patterns${Number.isFinite(preferences.preferred_time_of_travel) ? ` · usual travel time ${String(preferences.preferred_time_of_travel).padStart(2, "0")}:00` : ""}`
                                    : "No user behavior data yet — defaults remain active"}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setUsePreferences((v) => !v)}
                        style={{
                            border: `1px solid ${usePreferences ? Y : "rgba(255,255,255,.2)"}`,
                            color: usePreferences ? BK : "rgba(255,255,255,.7)",
                            background: usePreferences ? Y : "transparent",
                            padding: "6px 12px",
                            fontFamily: "'Bebas Neue',sans-serif",
                            fontSize: 13,
                            letterSpacing: 1.2,
                            cursor: "pointer",
                        }}
                    >
                        {usePreferences ? "ON" : "OFF"}
                    </button>
                </div>

                {/* Map */}
                <MapView
                    userLocation={effectiveUserLocation}
                    markers={mapMarkers}
                    routeGeometry={routeGeometry}
                    onMapReady={() => setMapActive(true)}
                    showAQI={showAQI}
                    onAQIToggle={() => setShowAQI((v) => !v)}
                />

                {/* Route Intelligence */}
                <RoutePanel
                    userLocation={effectiveUserLocation}
                    markers={mapMarkers}
                    onRouteCalculated={handleRouteCalculated}
                    usePreferences={usePreferences}
                    preferences={preferences}
                />

                {/* SOS Emergency Button */}
                <SOSButton dbUser={dbUser} userLocation={effectiveUserLocation} />

                {rerouteSuggestion && (
                    <div
                        style={{
                            position: "fixed",
                            bottom: 24,
                            left: "50%",
                            transform: "translateX(-50%)",
                            zIndex: 250,
                            width: "min(92vw, 520px)",
                            border: `1px solid rgba(204,255,0,.28)`,
                            background: "rgba(0,0,0,.92)",
                            backdropFilter: "blur(10px)",
                            padding: "14px 16px",
                            boxShadow: "0 18px 48px rgba(0,0,0,.32)",
                            animation: "ldm-step-in 0.25s ease both",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 16,
                                    letterSpacing: 1.6,
                                    color: Y,
                                }}
                            >
                                {rerouteSuggestion.summary || "Better route found — switch?"}
                            </span>
                            <button
                                type="button"
                                onClick={handleDismissReroute}
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "rgba(255,255,255,.45)",
                                    fontSize: 18,
                                    cursor: "pointer",
                                    lineHeight: 1,
                                }}
                            >
                                {"\u00D7"}
                            </button>
                        </div>
                        <div
                            style={{
                                fontFamily: "'DM Sans',sans-serif",
                                fontSize: 12,
                                lineHeight: 1.5,
                                color: "rgba(255,255,255,.62)",
                                marginBottom: 10,
                            }}
                        >
                            {rerouteSuggestion.triggerReason}
                            {rerouteSuggestion.nextBest?.label
                                ? ` Suggested mode: ${rerouteSuggestion.nextBest.label}.`
                                : ""}
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                                type="button"
                                onClick={handleDismissReroute}
                                style={{
                                    border: "1px solid rgba(255,255,255,.14)",
                                    background: "transparent",
                                    color: "rgba(255,255,255,.72)",
                                    padding: "7px 12px",
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 13,
                                    letterSpacing: 1.1,
                                    cursor: "pointer",
                                }}
                            >
                                KEEP CURRENT
                            </button>
                            <button
                                type="button"
                                onClick={handleAcceptReroute}
                                style={{
                                    border: `1px solid ${Y}`,
                                    background: Y,
                                    color: BK,
                                    padding: "7px 12px",
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 13,
                                    letterSpacing: 1.1,
                                    cursor: "pointer",
                                }}
                            >
                                SWITCH ROUTE
                            </button>
                        </div>
                    </div>
                )}

                {tourActive && (
                    <OnboardingTour
                        steps={TOUR_STEPS}
                        currentStep={currentStep}
                        totalSteps={totalSteps}
                        onNext={next}
                        onSkip={skip}
                        isActive={tourActive}
                    />
                )}

                {/* Status indicators */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                        gap: 10,
                    }}
                >
                    {[
                        { label: "AUTH", status: "ACTIVE", ok: true },
                        { label: "DATABASE", status: "ACTIVE", ok: true },
                        { label: "AI ENGINE", status: aiActive ? "ACTIVE" : "PENDING", ok: aiActive },
                        { label: "WEATHER", status: weather ? "ACTIVE" : "PENDING", ok: !!weather },
                        { label: "MAPS", status: mapActive ? "ACTIVE" : "PENDING", ok: mapActive },
                        { label: "ROUTES", status: routeActive ? "ACTIVE" : "PENDING", ok: routeActive },
                    ].map((item) => (
                        <div
                            key={item.label}
                            style={{
                                padding: "20px 16px",
                                border: `1px solid ${item.ok ? Y : "rgba(255,255,255,.08)"
                                    }`,
                                background: item.ok
                                    ? "rgba(204,255,0,.05)"
                                    : "rgba(255,255,255,.02)",
                            }}
                        >
                            <div
                                style={{
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 14,
                                    color: "rgba(255,255,255,.4)",
                                    letterSpacing: 2,
                                    marginBottom: 8,
                                }}
                            >
                                {item.label}
                            </div>
                            <div
                                style={{
                                    fontFamily: "'Bebas Neue',sans-serif",
                                    fontSize: 18,
                                    color: item.ok ? Y : "rgba(255,255,255,.25)",
                                    letterSpacing: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                }}
                            >
                                <span
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        background: item.ok ? Y : "rgba(255,255,255,.2)",
                                        display: "inline-block",
                                    }}
                                />
                                {item.status}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
