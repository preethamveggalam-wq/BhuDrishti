BhuDrishti V50

## V50 · Decision-support integration upgrade
This release implements the first five priority upgrades as a connected workflow without changing the established Explore Map / Future City architecture.

### 1. Evidence Chain
- Added a source-aware **Data → Spatial Analysis → Derived Signals → Evidence → Decision** chain under the selected-area intelligence panel.
- Clearly separates public/live record context from derived screening values.

### 2. Analyze This Area
- Added a dedicated **Analyze This Area** action that generates an expanded area-intelligence panel for the active parcel or geography.
- Shows land, development, environmental, infrastructure, mobility and people context with explicit derivation labels.

### 3. Past → Present → Future Time Machine
- Preserves the real archived/present/future map workflow.
- Timeline playback now moves sequentially from 2014 through 2045 and stops at the future endpoint instead of looping back to the past.
- Added a visible three-stage timeline path in Future City.

### 4. Policy Map Comparison
- Added a spatial comparison below Policy Sandbox: **Current** real map vs **Policy Scenario** real map with a clearly labelled modeled impact zone.
- The modeled zone is not presented as a legal parcel boundary.

### 5. Decision Brief
- Replaced the plain-text export with a self-contained HTML decision brief containing land context, derived screening indicators, the evidence chain and data-status notes.
- The downloaded HTML can be printed/saved as PDF from a browser.

### Run
```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000

BhuDrishti V37

BhuDrishti V35

Future City visual/detail upgrade based on the V34 stable release.

## V35 Future City upgrades
- Real 3D City view now uses the maintained OpenFreeMap 3D cartographic style instead of a custom blocky building renderer.
- Real OpenStreetMap/OpenMapTiles building, road, water, landuse and label context is preserved in the 3D city view.
- Future mapped construction / proposed evidence remains overlaid on the real basemap.
- When the user selects FUTURE, the inspector now shows a Future Outlook panel with **Potential Advantages** and **Disadvantages / Trade-offs**.
- Advantages include access/infrastructure, employment/economic activity, housing/services and investment signals.
- Trade-offs include mobility/congestion, land-use conversion, infrastructure capacity and green/environmental pressure.
- All future impact scores are explicitly marked **modeled / screening indicators, not official forecasts**.

## Run
```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000

BhuDrishti V34

This release fixes the Explore workspace JSX parser error in V34: a stray closing div was removed after the Verified Land Records component. No feature behavior was intentionally changed.

# BhuDrishti V24 — Future City Scenario Workspace

V24 keeps the stable V19 land-map / land-record workflow and focuses the update on **Future City**.

## Future City upgrades
- Natural-language future query with year extraction (for example, “after 10 years” → 2036).
- Real-color OpenFreeMap 2D basemap around Kandlakoya by default; any searchable place can be used.
- Satellite mode using Esri World Imagery.
- Modeled future footprints for employment/IT, residential, commercial/services and green/public-realm zones.
- Clickable 2D scenario zones with a clear “MODELED SCENARIO” label.
- 3D procedural city with existing buildings + modeled future buildings, roads, landscaping, moving vehicles and infrastructure visualization.
- 3D layer controls: ALL / TODAY / FUTURE / INFRA.
- Click a 3D future building to inspect its role.
- Year timeline from 2027–2045 with Play/Pause animation.
- Completion slider that changes the modeled development intensity.
- Synchronized scenario KPIs: population, potential direct workers, residential units, built-up delivery, development pressure, traffic intensity and transit connectivity.
- Explicit separation between **Known Today** context and **Modeled Future** outputs.

## Important data note
Future buildings, jobs, population and infrastructure in this workspace are scenario outputs for decision-support demonstration. They are **not guaranteed government plans or forecasts**. Employment uses the reported 10,000+ capacity context of the original Gateway IT Park plan and scales it using the selected year/completion assumptions.

## Run
```bash
npm install
npm run install:all
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:5000


## V24 Future City realism upgrade
- Reworked procedural buildings with layered facades, floor slabs, curtain-wall windows, vertical fins, balconies, entrances, rooftop mechanical equipment, solar arrays and antenna beacons.
- Added distant city massing, sidewalks, lane markings, streetlights and more detailed vehicles.
- Added subtle animated window lighting, moving traffic, swaying trees, streetlight pulse and a construction crane.
- Added interactive orbit/zoom/tilt controls to the 3D city view.
- Future City only; existing Land Map / Land Records functionality is preserved.


## V22 Future City search
Future City is no longer locked to Kandlakoya. Enter any city, town, district, village, landmark or other searchable place in the natural-language scenario box. Analyze Future geocodes the place through the backend, recenters the real-color/satellite map, and generates a location-specific deterministic scenario. Kandlakoya retains its source-backed context; other places are explicitly modeled scenarios.


## V24 — exact map-click analysis
- Every map click is treated as the primary spatial input.
- The map remains centered on the exact clicked latitude/longitude instead of using owner-table coordinates.
- Reverse geocoding is used to resolve the clicked locality (village/mandal/district) when available.
- The popup shows the exact clicked coordinates.
- Cached reverse-geocoding limits repeated requests while users explore the map.
- Existing Land Records and Future City workflows remain unchanged.


## V26 Verified Land Records reliability update
- Added tolerant BaseSurvey-first lookup for Telangana TGRAC public GIS, with case-insensitive locality matching and SubSurvey normalization.
- Added browser-direct public ArcGIS fallback when the local backend cannot reach TGRAC.
- Parcel geometry is fetched directly from the Telangana cadastral layer when available.
- Verified Land Records still uses live/public GIS data only; no synthetic record is created in this workflow.

## V28 — Historical Land-Change Analysis
- Year slider now drives a visible modeled land-change intensity overlay from 2010–2026.
- Added modeled urban-pressure, agricultural-retention and change-intensity indicators.
- Added optional 2010 ↔ 2026 analytical comparison card.
- Historical basemap imagery is not backdated; the map explicitly labels the overlay as modeled.


## V34 · Future City Time Machine
- Natural-language location search remains open to any searchable city, town, district, village or landmark.
- Future City now has a 2014–2045 time machine: Past (historical imagery), Present (current imagery), Future (modeled scenario).
- Historical imagery uses Esri World Imagery Wayback releases when the public archive catalog is available; the app falls back to known Wayback releases if the catalog cannot be loaded.
- Past/Present views use real satellite imagery; Future uses current real imagery underneath the clearly labeled BhuDrishti scenario overlays.
- The timeline can play across past → present → future.
- Historical release dates are labeled as archive release dates, not assumed image acquisition dates.


## V34 Future City Real-Map overhaul
- Removed procedural toy buildings from the default Future City 3D view.
- Past: Esri World Imagery Wayback archived satellite imagery.
- Present: current Esri World Imagery.
- 3D: real OpenStreetMap building footprints/heights via OpenFreeMap vector tiles.
- Future: only mapped under-construction / proposed features from OpenStreetMap Overpass are overlaid; no invented future buildings, jobs, population or roads.
- Added `/api/future-evidence` for location-based future evidence queries.


## V34 Explore Map cleanup
- Removed the modeled rectangular/grid land-change overlay from Land Map & GIS so the map remains a clean real-world geographic basemap.
- Removed the duplicate floating Selected Parcel information card from the map itself; parcel details remain in the right-side property panel.
- Removed the floating land-record target legend from over the map; map status remains as a compact lower-left status badge.
- Land Map & GIS now prioritizes the real street/satellite/3D map and selected parcel boundaries instead of decorative analytical overlays.


## V34 unified intelligence update
- Unified map context across Land DNA, risk radar, mobility/population proxies, AI Evidence, Research, Policy Sandbox, Future City and a downloadable Decision Brief.
- Added resilient UI ErrorBoundary recovery screen to prevent blank-workspace failures.
- Added Future City Earth Globe mode alongside real map/3D city mode.
- Future City time machine remains real archived/current imagery plus real OpenStreetMap-mapped construction/proposed evidence; modeled metrics are explicitly labeled.
- Added context handoff from Explore into AI, Research and Policy workspaces.

## V36 updates
- Future City search now has a dedicated any-location field and accepts cities, towns, districts, villages and landmarks. The default view is no longer locked to Kandlakoya.
- Analytics & Reports now has a city-only selector; all dashboard cards reload for the selected city.
- Added the first local demo login flow (superseded in V37 by real email verification sign-in).
- Expanded city catalog: Hyderabad, Bengaluru, Mumbai, Delhi, Chennai, Pune, Kolkata, Ahmedabad, Visakhapatnam, Warangal and Nizamabad.

## V37 real email sign-in
The prototype no longer creates fake local accounts. Login uses a real inbox verification code sent by the backend.

1. Copy `backend/.env.example` to `backend/.env` (or export the same environment variables in your shell).
2. Configure a real SMTP sender. For Gmail, use an App Password rather than your normal password.
3. Start the backend and frontend normally.
4. Click **Login**, enter an existing email address you can access, request the code, then verify it.

Required variables:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM` (optional; defaults to `SMTP_USER`)

Without SMTP configuration, the app intentionally shows a configuration message instead of pretending that a real email was sent.


## Authentication V38
- Email/password login is only for provisioned BhuDrishti users listed in `AUTH_USERS_JSON`; there is no create-account screen.
- For a real Gmail/Google account, use **Continue with Google**. Google passwords are entered only on Google's own page and never sent to BhuDrishti.
- After a successful login, BhuDrishti sends a login-success notification to the signed-in email using the configured SMTP account.
- Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SMTP_*`, and `EMAIL_FROM` in `backend/.env`.

## V38 login behavior
- **Real Gmail/Google:** click `Continue with Google`. The browser goes to Google's own authentication page. BhuDrishti never receives the Gmail password.
- **Email + password:** available only for provisioned BhuDrishti users in `AUTH_USERS_JSON`; there is intentionally no create-account screen.
- After successful authentication, the backend sends a `BhuDrishti login successful` email to the signed-in address via SMTP.
- For local development, configure both Google OAuth and SMTP in `backend/.env`.


## V39 fixes
- Land Map 3D uses the stable bright vector style plus real OpenMapTiles building extrusion, avoiding the blank 3D canvas caused by the standalone 3D style.
- Map click analysis keeps the exact clicked coordinates as the source of map focus and uses live point/cadastral/environmental context before any Map Explorer demo fallback.
- Demo fallback now uses reverse-geocoded/environmental locality values when available instead of random locality assignment.
- Login dialog is explicitly email + password, with Google OAuth as the secure real-Gmail path; stale verification-code UI is removed.


## V41 auth fix
- Backend explicitly loads `backend/.env` regardless of launch working directory.
- Google callback supports both `/auth/google/callback` and `/api/auth/google/callback`.
- The Google Cloud redirect URI can remain `http://localhost:5000/auth/google/callback`.


### Google OAuth troubleshooting (V42)
If Google shows `Error 401: invalid_client` or "The OAuth client was not found", open `http://localhost:5000/api/auth/google/config`. The response shows the masked client ID and redirect URI loaded by the backend. Compare the masked client ID to Google Cloud → Google Auth Platform → Clients → BhuDrishti Web. The client ID must be copied exactly and end with `.apps.googleusercontent.com`.


## V44 Simple Authentication
Login is intentionally simplified to BhuDrishti account creation and sign-in with name, email, and password. Accounts are persisted in `backend/data/users.json` with scrypt-hashed passwords. Google OAuth is not required for this flow. SMTP login-success notifications are optional; if SMTP is configured, the backend sends a notice after successful login, otherwise login still succeeds locally.


## V46 Future City 3D correction
The Future City 3D view no longer renders a separate concept-card scene. The real satellite map remains the single viewport, with OpenFreeMap/OpenMapTiles building footprints and heights styled as real mapped 3D buildings using class/colour data, smoother height interpolation, rounded extrusion corners, roof shading and stronger facade visibility.


V49 note: Future City has been restored to the pre-V45 presentation/3D experience from V44. The V48 Legal Research repair and other working platform changes remain in place.

## V51 additions
- Compare Two Areas panel in Explore with side-by-side city indicators.
- Data Confidence & Provenance panel distinguishing public/verified, derived, scenario and demo information.
- Land Governance Alert Center with attention signals tied to the selected city/parcel context.
- Officer Mode toggle for a decision-focused presentation layer and human-review banner.
- Three click-ready Demo Scenarios on Home for SIH walkthroughs: Urban Expansion, Agricultural Conversion, Infrastructure Planning.

## V52 additions
- Why am I seeing this? explainability controls on derived land-risk signals and modeled people/mobility values.
- Demo Safe mode with local fallback content, runtime-service notice, and recovery actions to avoid blank workflows.
- Workspace and startup recovery paths now offer a one-click Demo Safe fallback.
