# Lapwise

A locally runnable student laptop recommender built with React, TypeScript, Vite, and the supplied FastAPI recommendation engine.

The interface follows the [Lapwise Figma mockup](https://www.figma.com/design/gAsARb52B1uEQn0tBy87WI/4125-Laptop-Recommender?node-id=2-2): forest-green controls, warm off-white surfaces, a filter sidebar, laptop cards, a three-step student survey, and price tracking. Laptop names, specifications, prices, and rankings come from the supplied API and CSVs, rather than the mockup's illustrative products.

## Run locally (macOS / Linux)

Prerequisites: Python 3.12+ and Node.js 22+ with npm.

```bash
cd /Users/jimmy2/Downloads/Lapwise
./start.sh
```

The script creates an isolated `.venv`, installs the pinned Python and JavaScript dependencies, builds the frontend, then serves both the application and API from one process.

- App: http://127.0.0.1:8000
- Interactive API docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

First setup requires internet access for dependencies. After setup and build, restart offline with:

```bash
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Stop with `Ctrl+C`. If port 8000 is in use, run `PORT=8001 ./start.sh`. Servers bind only to localhost. No accounts, API keys, database server, or cloud hosting are required.

## MVP features

- Browse all seven laptops; the supplied tablet is excluded.
- Three-step survey: field of study, software profile, budget and preferences.
- Top-three ranked recommendations with match scores, reasons, tradeoffs, estimated-spec warnings, and strict budget/OS filters.
- Search, brand/memory/screen filters, recorded-price ceiling, below-median filter, and price sorting.
- Laptop details, retailer links, and side-by-side comparison of up to three laptops.
- Saved laptops and preferences persisted in the current browser.
- Real price observations plotted over 30 days, 90 days, or the full dataset.
- Local price targets, compared with each laptop's latest recorded price.
- Responsive layouts, keyboard-operable controls, native modal focus handling, loading/retry/error/empty states.

## Development

Install dependencies using `./start.sh` once, then stop it. Run two terminals from the repository root:

```bash
# Terminal 1: backend
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal 2: frontend with hot reload
npm --prefix frontend run dev
```

Open the Vite URL printed in Terminal 2 (normally http://127.0.0.1:5173). Vite proxies `/api` and `/health` to the backend. Browser storage is per origin, so the dev and built app keep separate saved preferences.

```bash
# Production TypeScript check and build
npm --prefix frontend run build

# API, data consistency, scoring, validation, and static app tests
.venv/bin/python -m pytest -q
```

Build before running the tests: one test verifies that FastAPI serves the built app. If the backend started before the first frontend build, restart it to mount the build. Rebuilding an existing build only requires a browser refresh.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/recommendations` | Existing survey contract and ranked results |
| GET | `/api/v1/options` | Supported survey enum values |
| GET | `/api/v1/laptops` | Browsable catalog and recorded-price summaries |
| GET | `/api/v1/laptops/{laptop_id}/prices` | Chronological CSV observations; URL-encode the laptop ID |
| GET | `/health` | Health and eligible laptop count |

The original API documentation, request example, and scoring explanation are in [docs/API.md](docs/API.md). The existing recommendation response shape is preserved; two read-only endpoints were added for the frontend. Options are loaded from the API rather than maintained independently in the form.

## Data and MVP boundaries

- `data/specs.csv` contains eight devices; seven qualify as laptops. `data/pricing_history.csv` contains 549 observations across the original dataset. Prices are recorded observations, **not live retailer quotes**.
- Chart periods end at the latest observation, not the current date. The app displays observation dates and passes through stale-price and estimated-RAM warnings from the API.
- Price targets are browser-local comparisons. There is no scraper, background polling, email delivery, or notification service.
- Saved laptops, preferences, and targets use local storage. No sign-in, cloud synchronization, analytics, or telemetry is included. If browser storage is unavailable, actions still work for the current session.
- Laptop pictures are original SVG illustrations, not verified product photography.
- Software profiles map to the existing API usage categories. They do not certify software compatibility or add GPU/battery/weight data absent from the source catalog.
- Changes to CSVs require a backend restart because the catalog is cached in memory. The original API project outside this clone is untouched.
- `requirements.txt` preserves the supplied dependency ranges. `requirements.lock` pins the environment used to verify this MVP; `frontend/package-lock.json` pins frontend dependencies. The lock is intended for the macOS/Linux workflow above.

## Layout

```text
app/                  FastAPI, CSV loading, scoring, schemas
frontend/src/
  App.tsx             Navigation, catalog, filters, saved items, comparison, trackers
  Survey.tsx          Three-step survey and API-backed options
  components.tsx      Laptop illustrations, charts, dialogs, persistence helpers
  api.ts              Typed HTTP client and API errors
  types.ts            API-facing TypeScript types
  style.css           Responsive UI styles
frontend/dist/        Generated production build (ignored)
data/                 Supplied catalog and price history
tests/test_api.py    API regression and integration tests
docs/API.md           Original API design and examples
start.sh              One-command setup, build, and local server
```
