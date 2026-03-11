# MargDarshak

> AI-powered travel assistant for Indian urban commuters. Ask in plain language, get transport options with safety context, eco scores, and route reasoning.

**Live demo:** https://pih-2026-nexus.vercel.app

---

## What it does

MargDarshak takes a natural language travel query — *"How do I get from Andheri to BKC?"* — and responds with a ranked comparison of transport options (walk, bus, train, metro, auto, cab), each annotated with estimated cost, duration, safety score, and CO₂ emissions. It explains why it picked the best option and surfaces relevant context: current weather, AQI, and time-of-day safety considerations.

Built specifically for Mumbai's transport complexity — fragmented local trains, multiple metro lines, BEST buses, and inconsistent safety conditions — with intent to extend to other Indian metros.

---

## Features

### AI Chat
- Natural language queries in English (Hindi-flavored queries partially supported)
- Intent classification across 6 types: `route`, `sightseeing`, `food`, `budget`, `safety`, `quick_trip`
- Groq (`llama-3.3-70b-versatile`) returns structured JSON — places, budget estimates, tips, transport options
- Chat history persisted to Supabase, restored on next session

### Transport Options
- **6 modes**: Walk, Cab, Auto, Bus, Local Train, Metro
- Mumbai-specific data: 85 BEST bus stops across 42 routes, Mumbai Metro Lines 1/2A/2B/7/7A/3 with real station data, Western and Central Railway local trains
- Best-route selection: minimises `cost + (duration_minutes / 60)` with a metro preference bonus for 5–25 km trips
- Walk excluded from best-pick beyond 2 km

### Context Layers
- **Weather + AQI** via Open-Meteo — temperature, conditions, rain probability, air quality (1–5 scale)
- **Safety zones** — 61 Mumbai zones with scores (1–10); scores reduced by 2 after 10 PM for zones flagged `nightRisk: true`
- **Eco scoring** — per-mode CO₂ factors (g/km): Walk 0, Metro 15, Train 20, Bus 30, Auto 80, Cab 120
- Weather and safety data injected into every AI request prompt

### Route Reasoning
- "Why this route?" panel — human-readable reasons comparing the selected option against alternatives (time saved, cost difference, AQI context, peak-hour status, safety score)
- "Explain my journey" — animated word-by-word narration of the selected route

### SOS
- Floating button, always visible on dashboard
- GPS with 3-tier fallback (live GPS → last known → cached → Delhi default)
- Reverse-geocoded address via Nominatim
- Pre-built emergency message (copy to clipboard), direct 112 dial link, Google Maps link
- Audio alert via Web Audio API (3 beeps at 800 Hz)
- AI safety guidance for the user's current location
- All triggers logged to Supabase `sos_logs`
- GPS and audio work offline

### Saved Trips
- Save any transport card to Supabase `saved_trips`
- Collapsible sidebar; click a saved trip to re-run the query
- Full CRUD: save, list, delete

### Offline Mode
- localStorage cache with TTLs: AI responses (2h), weather (30min), route intel (1h)
- Offline detection via `navigator.onLine` + polling
- Cached data served transparently when offline; red badge in status bar

### Authentication
- Clerk — Google OAuth and Email OTP
- Dashboard protected; unauthenticated users redirected to sign-in
- Clerk user synced to Supabase `users` on first login
- Navbar adapts: LOGIN when signed out, DASHBOARD + avatar when signed in

### PWA
- Installable on Android and iOS from the browser
- Workbox service worker (`generateSW` mode) — 12 static assets precached
- Runtime caching: map tiles and fonts (CacheFirst), Clerk auth (NetworkFirst)
- Custom install prompt component, auto-hides after install or in standalone mode

### Android (TWA)
- Signed APK built via Bubblewrap CLI wrapping the deployed PWA — no React Native
- Package: `com.margdarshak.app` | minSdk 21 | targetSdk 34
- Digital Asset Links at `/.well-known/assetlinks.json` — no browser chrome in-app
- APK size: ~1 MB

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 18.2.0 |
| Build | Vite | 5.0.0 |
| Routing | React Router DOM | 7.13.1 |
| Auth | Clerk | 5.61.3 |
| Database | Supabase (PostgreSQL) | 2.98.0 |
| AI | Groq — `llama-3.3-70b-versatile` | — |
| Maps | React Leaflet + Leaflet.js | 4.2.1 / 1.9.4 |
| Weather / AQI | Open-Meteo | Free, no key |
| Geocoding | Nominatim | Free, no key |
| Road distance | OpenRouteService | Free tier |
| Icons | Lucide React | 0.575.0 |
| Styling | Inline styles + global.css | No framework |
| PWA | vite-plugin-pwa (Workbox) | 1.24.1 |
| Android | Bubblewrap CLI | 1.24.1 |

No Tailwind or component libraries. Responsive behaviour via CSS media queries in `global.css`, `clamp()` for fluid typography, and `auto-fit` grids.

---

## Architecture

```
Browser (React SPA — Vite 5)
│
├── Clerk Auth
├── React Leaflet (CartoDB Dark Matter tiles)
│
├── intentClassifier.js     — keyword matching, 6 intent types, confidence score
├── aiService.js            — Groq API wrapper, JSON mode, offline cache
├── routeService.js         — ORS + haversine fallback, mode builder, best-pick algo
├── metroService.js         — Mumbai metro station data, interchange pathfinding
├── busService.js           — 85 BEST stops, 42 routes, fare calculation
├── safetyService.js        — zone scoring, night penalties, per-mode adjustments
├── ecoScoreService.js      — CO₂ calculation, eco labels
├── weatherService.js       — Open-Meteo: weather, AQI, rain probability
├── explainRouteService.js  — reasoning engine: ETA/cost/AQI/safety comparisons
├── sosService.js           — GPS fallback chain, reverse geocode, audio alert
├── offlineCache.js         — localStorage TTL cache
└── supabaseClient.js       — CRUD helpers for all 7 tables
│
└── Supabase (PostgreSQL + RLS)
    users · ai_history · intents · environment_logs
    saved_trips · sos_logs · trips
```

---

## AI Workflow

```
User query
    │
    ▼
intentClassifier.js
    — keyword matching → intent type + confidence (0–1)
    — buildIntentPrompt() → mode-specific system instructions
    │
    ▼
aiService.js → Groq API
    — prompt includes: system context, location, weather, intent
    — returns typed JSON: places[], budget, tips[], transportOptions[], smartSuggestions{}
    │
    ▼
enrichWithEco() (client-side)
    — parses duration string → distance estimate → CO₂ per mode
    │
    ▼
explainRouteService.js
    — compares best option vs. alternatives
    — generates reasons[]: time diff, cost diff, AQI context, peak hours, safety score
    │
    ▼
UI render: TransportReveal → WhyThisRoute → JourneyExplainer → SmartSuggestions
```

**Intent types:**

| Intent | Example keywords | AI behaviour |
|---|---|---|
| `route` | metro, station, train, bus, how to reach | Full transport comparison |
| `sightseeing` | tourist, visit, monument, heritage | Places with costs and timings |
| `food` | restaurant, eat, biryani, street food | Food spots with INR breakdown |
| `budget` | cheap, affordable, save money | Cost-focused tips |
| `safety` | safe, night, solo, women | Safety ratings and contacts |
| `quick_trip` | quick, layover, 2 hours | Top 2–3 nearby spots |

---

## Folder Structure

```
client/
├── index.html
├── package.json
├── vite.config.js              # VitePWA, Workbox config
├── .env.example
│
├── public/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── .well-known/
│       └── assetlinks.json     # TWA Digital Asset Links
│
├── supabase/
│   └── migrations/
│       └── full_schema.sql     # All 7 tables + RLS policies
│
└── src/
    ├── main.jsx                # App entry, Clerk provider, ErrorBoundary
    ├── App.jsx                 # Routes
    ├── constants/theme.js      # Y="#CCFF00", BK="#000", WH="#fff"
    ├── data/safetyZones.json   # 61 Mumbai zones
    │
    ├── hooks/
    │   ├── useClerkAvailable.jsx
    │   ├── useGeolocation.js
    │   ├── useInView.js
    │   └── useUserSync.js
    │
    ├── utils/offlineCache.js
    │
    ├── services/
    │   ├── aiService.js
    │   ├── busService.js
    │   ├── ecoScoreService.js
    │   ├── environmentService.js
    │   ├── explainRouteService.js
    │   ├── intentClassifier.js
    │   ├── metroService.js
    │   ├── routeService.js
    │   ├── safetyService.js
    │   ├── sosService.js
    │   ├── supabaseClient.js
    │   └── weatherService.js
    │
    ├── components/
    │   ├── AIChat.jsx
    │   ├── Cursor.jsx
    │   ├── FeatureCard.jsx
    │   ├── Footer.jsx
    │   ├── IntentInput.jsx
    │   ├── JourneyExplainer.jsx
    │   ├── LocationBar.jsx
    │   ├── MapView.jsx
    │   ├── NavAuthButtons.jsx
    │   ├── Navbar.jsx
    │   ├── ProtectedRoute.jsx
    │   ├── PWAInstallPrompt.jsx
    │   ├── RoutePanel.jsx
    │   ├── SavedRoutes.jsx
    │   ├── SmartSuggestions.jsx
    │   ├── SOSButton.jsx
    │   ├── Ticker.jsx
    │   ├── WeatherBadge.jsx
    │   └── WhyThisRoute.jsx
    │
    ├── pages/
    │   ├── DashboardPage.jsx
    │   ├── LandingPage.jsx
    │   ├── SignInPage.jsx
    │   └── SignUpPage.jsx
    │
    ├── sections/
    │   ├── ContactSection.jsx
    │   ├── FeaturesSection.jsx
    │   ├── HeroSection.jsx
    │   ├── IntroSection.jsx
    │   ├── StatsSection.jsx
    │   ├── TickerSection.jsx
    │   └── WorkSection.jsx
    │
    └── styles/global.css
```

---

## Local Setup

**Prerequisites:** Node.js 18+, npm 9+, accounts on [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Groq](https://console.groq.com), [OpenRouteService](https://openrouteservice.org)

```bash
git clone https://github.com/SanskarG-20/PIH2026_Nexus.git
cd PIH2026_Nexus/client
npm install
cp .env.example .env
# fill in .env (see below)
npm run dev
# → http://localhost:5173
```

**Database:** paste `client/supabase/migrations/full_schema.sql` into the Supabase SQL editor and run it.

---

## Environment Variables

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GROQ_API_KEY=gsk_...
VITE_ORS_API_KEY=eyJvcmci...
```

Graceful degradation when keys are missing:
- No Clerk key → auth disabled, dashboard inaccessible
- No Groq key → AI chat returns an error message
- No ORS key → distances fall back to haversine calculation
- No Supabase key → persistence disabled, rest of app functional

---

## API Integrations

| Service | Purpose | Key required | Free tier |
|---|---|---|---|
| Groq | LLM inference | Yes | 500 req/day |
| Supabase | PostgreSQL + RLS | Yes | 500 MB |
| Clerk | Auth | Yes | 10,000 MAU |
| Open-Meteo | Weather + AQI | No | Unlimited |
| OpenRouteService | Road distance + GeoJSON | Yes | 2,000 req/day |
| Nominatim | Geocoding | No (User-Agent) | Fair use |

**Supabase tables:** `users`, `trips`, `ai_history`, `intents`, `environment_logs`, `saved_trips`, `sos_logs` — all with RLS enabled.

---

## Roadmap

- [ ] Delhi NCR and Bangalore metro data
- [ ] BEST Mumbai GTFS-RT for live bus tracking
- [ ] Voice input (Web Speech API)
- [ ] Hindi / Marathi query support
- [ ] Multi-city safety zone datasets
- [ ] Full multi-modal trip planning (chained transfers)
- [ ] Crowd-sourced safety incident reports

---

## Known Limitations

- Transport data is Mumbai-only; other cities return generic AI estimates without real stop/station data
- Bus and train timings are estimated, not pulled from a live schedule API
- Safety zones are manually curated — not updated in real time
- Groq free tier (500 req/day) can throttle under heavy usage
- ORS free tier (2,000 req/day) falls back to straight-line haversine when exhausted

---

*Built for PIH 2026 — Nexus track*
