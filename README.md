<p align="center">
  <strong>MARGDARSHAK</strong><br/>
  <em>AI-Powered Travel Intelligence for India</em>
</p>

<p align="center">
  <a href="https://margdarshak-2026.vercel.app">Live Demo</a> ·
  <a href="#getting-started">Quick Start</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/react-18.2-61DAFB?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/vite-5.x-646CFF?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/supabase-PostgreSQL-3FCF8E?logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/groq-LLM-black" alt="Groq" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Overview

MargDarshak is a client-side React application that takes natural-language travel queries — *"How do I get from Andheri to BKC?"* — and returns ranked transport options enriched with cost, duration, safety scores, crowd levels, eco impact, and AI-generated context. It includes live GPS-based journey tracking with adaptive rerouting, a continuous AI copilot, predictive alerts, emergency SOS, and a travel analytics dashboard.

Built specifically for Mumbai's multi-modal transport complexity, with architecture designed to extend to other Indian metros.

---

## Key Features

| Feature | Description |
|---|---|
| **AI Travel Chat** | Natural-language queries → structured JSON itinerary, places, transport options, tips |
| **6 Transport Modes** | Walk, Cab, Bus, Local Train, Metro, Auto — with real Mumbai station/route data |
| **Smart Routing** | Best-option ranking using cost, ETA, crowd, personalization, and safety |
| **Live Journey Tracking** | GPS-based rerouting when deviation > 300 m or delay exceeds threshold |
| **AI Copilot** | Continuous assistant during active journeys with interruptible suggestions |
| **Predictive Alerts** | Rule-based rain, peak-hour, and AQI warnings before you travel |
| **Personalization** | Learns preferred modes, budget, and travel time from user behavior |
| **Safety Intelligence** | Mumbai safety zones with night penalties; "Safety First Mode" toggle |
| **Eco Scoring** | Per-mode CO₂ estimation and savings comparison vs cab baseline |
| **Crowd Density** | Heuristic crowd scoring across transport modes and time of day |
| **SOS Emergency** | One-tap emergency button with GPS, dial link, and audio alert |
| **Travel Analytics** | Trip count, avg cost, time saved, CO₂ saved — built from your data |
| **Saved Trips** | Save, list, and re-run any route from Supabase |
| **Offline Mode** | localStorage cache with TTL; transparent fallback when offline |
| **PWA + Android** | Installable on Android/iOS; Android TWA wrapper included |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Browser (React SPA)                │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Clerk   │  │ Leaflet  │  │  Service Layer    │  │
│  │  Auth    │  │  Maps    │  │  aiService        │  │
│  └──────────┘  └──────────┘  │  routeService     │  │
│                              │  metroService      │  │
│  ┌──────────────────────┐    │  busService        │  │
│  │   Dashboard Pages    │    │  trainService      │  │
│  │   ┌───────────────┐  │    │  safetyService     │  │
│  │   │  AI Chat      │  │    │  personalization   │  │
│  │   │  Map View     │  │    │  liveRouting       │  │
│  │   │  Route Panel  │  │    │  continuousCopilot │  │
│  │   │  SOS Button   │  │    │  weather/AQI       │  │
│  │   │  Analytics    │  │    │  ecoScore/crowd    │  │
│  │   └───────────────┘  │    └──────────────────┘  │
│  └──────────────────────┘                          │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │           Supabase (PostgreSQL + RLS)         │   │
│  │  users · trips · ai_history · saved_trips     │   │
│  │  intents · env_logs · user_preferences        │   │
│  │  sos_logs · safety_reports                    │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘

External APIs (called client-side):
  Groq · Open-Meteo · Nominatim · OpenRouteService
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| UI | React 18, React Router 7 | Inline styles, no CSS framework |
| Build | Vite 5 | HMR, PWA plugin |
| Auth | Clerk | Google OAuth, Email OTP; degrades without key |
| Database | Supabase (PostgreSQL) | RLS enabled, 9 tables |
| LLM | Groq `llama-3.3-70b-versatile` | Structured JSON output |
| Maps | React Leaflet + Leaflet.js | CartoDB dark tiles |
| Weather/AQI | Open-Meteo | Free, no API key |
| Geocoding | Nominatim | Free, fair use |
| Road Distance | OpenRouteService | Free tier (2,000 req/day) |
| PWA | vite-plugin-pwa + Workbox | Offline caching, installable |
| Android | Bubblewrap TWA | Native wrapper with keystore |

---

## Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- Accounts on [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Groq](https://console.groq.com), and [OpenRouteService](https://openrouteservice.org)

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/SanskarG-20/MargDarshak.git
cd MargDarshak/client

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys (see Environment Variables below)

# 4. Start the dev server
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Environment Variables

Create `client/.env` from the template:

```env
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Groq AI
VITE_GROQ_API_KEY=gsk_...

# OpenRouteService
VITE_ORS_API_KEY=eyJvcmci...
```

**Graceful degradation** — the app works without any keys:

| Missing Key | Effect |
|---|---|
| Clerk | Auth disabled; dashboard accessible directly |
| Supabase | No persistence (chat history, saved trips, etc.) |
| Groq | AI chat unavailable; other features work |
| ORS | Route distance falls back to haversine estimation |

---

## Database Setup

Run the migrations in the Supabase SQL Editor in this order:

1. `supabase/migrations/full_schema.sql` — core tables and RLS policies
2. `supabase/migrations/safety_reports.sql` — community safety reports table
3. `supabase/migrations/personalization_engine.sql` — personalization columns
4. `supabase/migrations/add_preferred_time_of_travel.sql` — missing column fix
5. `supabase/migrations/fix_safety_reports_rls.sql` — hardened insert/delete policies
6. `supabase/migrations/fix_rls_per_user_policies.sql` — per-user session-based RLS

**Tables:** `users`, `trips`, `ai_history`, `intents`, `environment_logs`, `saved_trips`, `user_preferences`, `sos_logs`, `safety_reports`

---

## Project Structure

```
MargDarshak/
├── README.md
├── vercel.json                    # Vercel deployment config
├── .gitignore
│
├── android-twa/                   # Android TWA wrapper (gitignored)
│
└── client/
    ├── index.html
    ├── package.json
    ├── vite.config.js             # Vite + PWA + Workbox config
    ├── .env.example
    │
    ├── public/                    # PWA icons, assetlinks.json
    │
    ├── supabase/
    │   └── migrations/            # SQL schema + RLS migrations
    │
    └── src/
        ├── main.jsx               # Entry: ClerkProvider, BrowserRouter, ErrorBoundary
        ├── App.jsx                # Route definitions
        ├── constants/theme.js     # Color palette (Y, BK, WH)
        ├── context/JourneyContext.jsx
        │
        ├── hooks/
        │   ├── useClerkAvailable.jsx
        │   ├── useGeolocation.js
        │   ├── useUserSync.js
        │   └── useOnboardingTour.js
        │
        ├── utils/
        │   ├── geo.js             # Shared haversine/geo helpers
        │   └── offlineCache.js    # localStorage cache with TTL
        │
        ├── services/              # Core business logic
        │   ├── aiService.js       # Groq LLM integration + system prompt
        │   ├── intentClassifier.js
        │   ├── routeService.js    # ORS + multi-mode comparison
        │   ├── metroService.js    # Mumbai Metro lines 1, 2A, 3, 7
        │   ├── busService.js      # BEST bus routes (~70 stops)
        │   ├── trainService.js    # Western + Central Railway
        │   ├── safetyService.js   # Zone-based safety scoring
        │   ├── personalizationService.js
        │   ├── liveRoutingService.js
        │   ├── continuousCopilotService.js
        │   ├── predictiveService.js
        │   ├── weatherService.js  # Open-Meteo weather + AQI
        │   ├── ecoScoreService.js
        │   ├── crowdService.js
        │   ├── explainRouteService.js
        │   ├── analyticsService.js
        │   ├── sosService.js
        │   ├── environmentService.js
        │   └── supabaseClient.js  # Supabase client + all DB operations
        │
        ├── components/
        │   ├── ErrorBoundary.jsx
        │   ├── AIChat.jsx
        │   ├── MapView.jsx
        │   ├── RoutePanel.jsx
        │   ├── SOSButton.jsx
        │   ├── IntentInput.jsx
        │   ├── ContinuousCopilotPanel.jsx
        │   ├── SavedRoutes.jsx
        │   ├── TravelAnalyticsPanel.jsx
        │   ├── JourneyExplainer.jsx
        │   ├── WhyThisRoute.jsx
        │   ├── ComparePanel.jsx
        │   ├── SmartSuggestions.jsx
        │   ├── TripTimeline.jsx
        │   ├── WeatherBadge.jsx
        │   ├── LocationBar.jsx
        │   ├── OnboardingTour.jsx
        │   └── Cursor.jsx
        │
        ├── pages/
        │   ├── LandingPage.jsx
        │   ├── DashboardPage.jsx
        │   ├── SignInPage.jsx
        │   └── SignUpPage.jsx
        │
        ├── sections/              # Landing page sections
        │   ├── HeroSection.jsx
        │   ├── FeaturesSection.jsx
        │   └── ...
        │
        ├── data/
        │   └── safetyZones.json   # Mumbai safety zone data
        │
        └── styles/
            └── global.css
```

---

## AI Data Flow

```
User types query
  │
  ├─ intentClassifier.js ──► classifies as route/sightseeing/food/budget/safety/quick_trip
  │
  ├─ aiService.js
  │   ├─ Builds system prompt (~200 lines of transport rules)
  │   ├─ Appends context: location, weather, intent, personalization, safe mode
  │   ├─ Sends to Groq llama-3.3-70b-versatile
  │   └─ Returns structured JSON
  │       ├─ itinerary[]
  │       ├─ places[] (with lat/lng)
  │       ├─ transportOptions[] (mode, boarding, cost, duration, crowd)
  │       └─ smartSuggestions{}
  │
  ├─ Client-side enrichment
  │   ├─ ecoScoreService ──► CO₂ per mode
  │   ├─ safetyService ──► safety score per route segment
  │   └─ crowdService ──► crowd density estimate
  │
  └─ UI renders
      ├─ TripTimeline
      ├─ Transport cards with best-option ranking
      ├─ WhyThisRoute explanation panel
      └─ SmartSuggestions sidebar
```

**During active journey:**

```
navigator.geolocation.watchPosition()
  │
  ├─ liveRoutingService ──► detects deviation / delay
  │   └─ suggestBetterRoute() ──► reroute floating panel
  │
  └─ continuousCopilotService ──► builds snapshot
      └─ askJourneyCopilot() ──► AI copilot suggestion
          └─ ContinuousCopilotPanel (floating, interruptible)
```

---

## Scripts

```bash
npm run dev      # Start Vite dev server (http://localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

---

## Deployment

**Vercel** (production):

The `vercel.json` at the repo root handles everything:

```json
{
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Connect the repo to Vercel and add the environment variables in the Vercel dashboard. The SPA rewrite ensures React Router handles all routes.

**Android TWA:**

The `android-twa/` directory (gitignored) contains a Bubblewrap-generated Android project. Build with:

```bash
cd android-twa
./gradlew assembleRelease
```

Output: `app-release-unsigned-aligned.apk`

---

## Security Considerations

- **RLS policies** enforce per-user data isolation via `set_app_user()` session variable
- **Auth** degrades gracefully — Clerk can be removed without breaking other features
- **API keys** are exposed client-side (Vite `VITE_` prefix) — these are all free-tier keys with limited scope
- **No admin operations** are exposed in the client code
- **SOS logs** are append-only and non-sensitive
- **Safety reports** use geospatial queries with 24-hour expiry

---

## Roadmap

- [ ] Delhi NCR and Bangalore live transit data
- [ ] Hindi / Marathi conversational support
- [ ] Multi-city safety zone datasets
- [ ] Real-time GTFS/Open Transit Data for crowd and delay detection
- [ ] Server-side API proxy to protect LLM and routing API keys
- [ ] Supabase Edge Functions for server-side auth verification
- [ ] Code splitting and lazy loading for initial bundle optimization
- [ ] Unit and integration test coverage
- [ ] CI/CD pipeline (GitHub Actions)

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit changes (`git commit -m "feat: add your feature"`)
4. Push to branch (`git push origin feat/your-feature`)
5. Open a Pull Request

---

## License

MIT

---

<p align="center">
  Built for <strong>Mumbai</strong>. Designed for <strong>India</strong>.
</p>
