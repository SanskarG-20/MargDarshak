# MargDarshak

> AI-powered travel assistant for Indian urban commuters. Ask in plain language, get transport options with safety context, eco scores, live rerouting, predictive alerts, and continuous journey guidance.

**Live demo:** https://margdarshak-2026.vercel.app

---

## What it does

MargDarshak takes a natural language travel query such as "How do I get from Andheri to BKC?" and responds with a ranked comparison of transport options like walk, bus, train, metro, auto, and cab. Each option is enriched with estimated cost, duration, safety score, crowd level, and CO2 impact. The system explains why it picked the best option, learns from user behavior, and surfaces contextual signals such as weather, AQI, predictive delays, and time-of-day safety considerations.

Once a journey starts, the app can continue assisting in real time with live rerouting, proactive alerts, and an interruptible AI copilot panel.

Built specifically for Mumbai's transport complexity, with intent to extend to other Indian metros.

---

## Features

### AI Chat
- Natural language travel queries in English, with partial support for Hindi-flavored phrasing
- Intent classification across 6 types: `route`, `sightseeing`, `food`, `budget`, `safety`, `quick_trip`
- Groq (`llama-3.3-70b-versatile`) returns structured JSON with itinerary, places, budget estimates, tips, transport options, and smart suggestions
- Chat history persisted to Supabase and restored on next session
- One-click delete chat history button clears persisted `ai_history`

### Structured Trip Planner
- Full-day and multi-stop trip plans rendered as a timeline
- AI schema includes `itinerary: [{ time, place, transport, cost }]`
- Timeline UI sits alongside places, route options, and local tips

### Transport Options
- 6 modes: Walk, Cab, Auto, Bus, Local Train, Metro
- Mumbai-specific data: BEST bus routes, Mumbai Metro lines, Western and Central local trains
- Best-route ranking uses cost, ETA, crowd pressure, personalization, and optional safety-first routing
- Walk excluded from best-pick beyond 2 km
- Compare panel for side-by-side route inspection

### Personalization + Safety
- Personalization engine stores `user_preferences` and learns from `saved_trips` and `ai_history`
- Route ranking adapts to preferred modes, usual budget, and travel-hour behavior
- Safe Mode / "Safety First Mode" heavily penalizes low-safety and `nightRisk` segments
- Explain panel includes behavior-aware reasoning such as "Based on your past behavior..."

### Context Layers
- Weather + AQI via Open-Meteo: temperature, conditions, rain probability, and air quality
- Safety zones for Mumbai, with night penalties for `nightRisk` areas
- Crowd density intelligence with heuristic scoring and API seam for future GTFS/open-data integration
- Eco scoring with per-mode CO2 factors
- Weather, safety, preferences, and safe-mode context injected into AI prompts

### Predictive Alerts
- Rule-based predictive travel alerts for rain delays, peak-hour congestion, and AQI spikes
- Dashboard banner surfaces suggestions like "Leave 15 min early"
- Works even without heavy ML or live transport APIs

### Live Journey Intelligence
- `navigator.geolocation.watchPosition()` powers active journey tracking
- Live adaptive rerouting triggers when deviation exceeds 300 m or delay exceeds threshold
- Continuous AI Copilot runs on a timed loop during active journeys
- Copilot suggestions are interruptible and can say things like "Get down at next stop"
- Floating panel can be paused, resumed, or dismissed without ending the journey

### Route Reasoning
- "Why this route?" panel compares selected option against alternatives
- "Explain my journey" generates a human-readable route explanation
- Explanations reflect weather, crowd, personalization, and Safe Mode

### Saved Trips
- Save any transport card to Supabase `saved_trips`
- Collapsible saved-routes list
- Click a saved trip to re-run the route query
- Full CRUD: save, list, delete

### Analytics
- User Travel Analytics dashboard built from `saved_trips` and `ai_history`
- Metrics include total trips, average cost, estimated time saved, and estimated CO2 saved
- Lightweight inline charts for mode share and time-of-day patterns
- No heavy chart library added

### SOS
- Floating emergency button on dashboard
- GPS fallback chain with reverse-geocoded address
- Pre-built emergency message, 112 dial link, Google Maps link
- Audio alert via Web Audio API
- AI safety guidance for current location
- All triggers logged to Supabase `sos_logs`

### Offline Mode
- localStorage cache with TTLs for AI responses, weather, and route intelligence
- Offline detection via `navigator.onLine` and cache flag polling
- Cached data served transparently when offline

### Authentication
- Clerk for Google OAuth and Email OTP
- Dashboard protected for authenticated users
- Clerk user synced to Supabase `users`

### PWA + Android
- Installable PWA for Android and iOS
- Workbox service worker
- Bubblewrap-based Android TWA wrapper

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18.2.0 |
| Build | Vite | 5.x |
| Routing | React Router DOM | 7.13.1 |
| Auth | Clerk | 5.61.3 |
| Database | Supabase (PostgreSQL) | 2.98.0 |
| AI | Groq `llama-3.3-70b-versatile` | - |
| Maps | React Leaflet + Leaflet.js | 4.2.1 / 1.9.4 |
| Weather / AQI | Open-Meteo | Free, no key |
| Geocoding | Nominatim | Free, no key |
| Road distance | OpenRouteService | Free tier |
| Icons | Lucide React | 0.575.0 |
| Styling | Inline styles + global.css | No framework |
| PWA | vite-plugin-pwa | 1.24.1 |
| Android | Bubblewrap CLI | 1.24.1 |

No Tailwind or large component/chart libraries are required.

---

## Architecture

```text
Browser (React SPA)
|
|-- Clerk Auth
|-- React Leaflet
|
|-- intentClassifier.js
|-- aiService.js
|-- routeService.js
|-- metroService.js
|-- busService.js
|-- trainService.js
|-- safetyService.js
|-- personalizationService.js
|-- crowdService.js
|-- predictiveService.js
|-- liveRoutingService.js
|-- continuousCopilotService.js
|-- analyticsService.js
|-- ecoScoreService.js
|-- weatherService.js
|-- explainRouteService.js
|-- supabaseClient.js
|
`-- Supabase
    users
    trips
    ai_history
    intents
    environment_logs
    saved_trips
    sos_logs
    user_preferences
    safety_reports
```

---

## AI Workflow

```text
User query
  -> intentClassifier.js
  -> aiService.js
     prompt includes location, weather, intent, personalization, safe mode
  -> structured JSON response
     itinerary[]
     places[]
     transportOptions[]
     smartSuggestions{}
  -> client-side enrichments
     eco scoring
     safety scoring
     crowd scoring
  -> explainRouteService.js
  -> UI render
     TripTimeline
     TransportReveal
     WhyThisRoute
     JourneyExplainer
     SmartSuggestions
```

During an active journey:

```text
watchPosition()
  -> liveRoutingService.js
  -> weather refresh
  -> continuousCopilotService.js snapshot
  -> optional askJourneyCopilot()
  -> floating assistant panel
```

---

## Folder Structure

```text
client/
|-- index.html
|-- package.json
|-- vite.config.js
|-- .env.example
|
|-- public/
|   |-- icon-192.png
|   |-- icon-512.png
|   `-- .well-known/assetlinks.json
|
|-- supabase/
|   `-- migrations/
|
`-- src/
    |-- main.jsx
    |-- App.jsx
    |-- constants/theme.js
    |-- context/JourneyContext.jsx
    |-- data/safetyZones.json
    |
    |-- hooks/
    |   |-- useClerkAvailable.jsx
    |   |-- useGeolocation.js
    |   |-- useInView.js
    |   |-- useOnboardingTour.js
    |   `-- useUserSync.js
    |
    |-- utils/offlineCache.js
    |
    |-- services/
    |   |-- aiService.js
    |   |-- analyticsService.js
    |   |-- busService.js
    |   |-- continuousCopilotService.js
    |   |-- crowdService.js
    |   |-- ecoScoreService.js
    |   |-- environmentService.js
    |   |-- explainRouteService.js
    |   |-- intentClassifier.js
    |   |-- liveRoutingService.js
    |   |-- metroService.js
    |   |-- personalizationService.js
    |   |-- predictiveService.js
    |   |-- routeService.js
    |   |-- safetyService.js
    |   |-- sosService.js
    |   |-- supabaseClient.js
    |   |-- trainService.js
    |   `-- weatherService.js
    |
    |-- components/
    |   |-- AIChat.jsx
    |   |-- ComparePanel.jsx
    |   |-- ContinuousCopilotPanel.jsx
    |   |-- Cursor.jsx
    |   |-- IntentInput.jsx
    |   |-- JourneyExplainer.jsx
    |   |-- LocationBar.jsx
    |   |-- MapView.jsx
    |   |-- OnboardingTour.jsx
    |   |-- RoutePanel.jsx
    |   |-- SavedRoutes.jsx
    |   |-- SmartSuggestions.jsx
    |   |-- SOSButton.jsx
    |   |-- TravelAnalyticsPanel.jsx
    |   |-- TripTimeline.jsx
    |   |-- WeatherBadge.jsx
    |   `-- WhyThisRoute.jsx
    |
    `-- pages/
        |-- DashboardPage.jsx
        |-- LandingPage.jsx
        |-- SignInPage.jsx
        `-- SignUpPage.jsx
```

---

## Local Setup

**Prerequisites:** Node.js 18+, npm 9+, accounts on Clerk, Supabase, Groq, and OpenRouteService.

```bash
git clone https://github.com/SanskarG-20/MargDarshak.git
cd MargDarshak/client
npm install
cp .env.example .env
# fill in .env
npm run dev
```

If your repository remote still points to an older path, update it to the current GitHub repository before pushing.

---

## Environment Variables

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GROQ_API_KEY=gsk_...
VITE_ORS_API_KEY=eyJvcmci...
```

Graceful degradation:
- No Clerk key: auth disabled
- No Groq key: AI chat unavailable
- No ORS key: route distance falls back to haversine
- No Supabase key: persistence disabled

---

## API Integrations

| Service | Purpose | Key required | Free tier |
|---|---|---|---|
| Groq | LLM inference | Yes | Yes |
| Supabase | PostgreSQL + RLS | Yes | Yes |
| Clerk | Auth | Yes | Yes |
| Open-Meteo | Weather + AQI | No | Yes |
| OpenRouteService | Road distance + GeoJSON | Yes | Yes |
| Nominatim | Geocoding | No | Fair use |

Supabase tables in active use include `users`, `trips`, `ai_history`, `intents`, `environment_logs`, `saved_trips`, `sos_logs`, `user_preferences`, and `safety_reports`.

---

## Roadmap

- [ ] Delhi NCR and Bangalore live transit data
- [ ] Hindi / Marathi conversational support
- [ ] Multi-city safety zone datasets
- [ ] Stronger live transport API integrations for crowd and delay detection
- [x] Structured day itineraries
- [x] Personalized routing
- [x] Live adaptive rerouting
- [x] Crowd-aware routing
- [x] Predictive travel alerts
- [x] Continuous AI journey copilot
- [x] Travel analytics dashboard
- [x] Crowd-sourced safety incident reports

---

## Known Limitations

- Transport data is still Mumbai-first; other cities may fall back to generic AI estimates
- Bus and train timings are estimated unless live API data is added
- Safety zones are manually curated and not real-time authoritative
- Crowd, predictive alerts, and copilot guidance rely on heuristic fallbacks when external live transit APIs are unavailable
- Groq and ORS free tiers can become limiting under heavy usage
