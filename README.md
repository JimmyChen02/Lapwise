# Lapwise

A locally runnable student laptop recommender built with React, TypeScript, Vite, and the supplied FastAPI recommendation engine.

The interface follows the [Lapwise Figma mockup](https://www.figma.com/design/gAsARb52B1uEQn0tBy87WI/4125-Laptop-Recommender?node-id=2-2): forest-green controls, warm off-white surfaces, a filter sidebar, laptop cards, a three-step student survey, and price tracking. Laptop names, specifications, prices, and rankings come from the supplied API and CSVs, rather than the mockup's illustrative products.

## Quick start (macOS / Linux)

Install **Git**, **Python 3.12 or newer**, and **Node.js 22 or newer** (including npm). Open a terminal in any folder where you want to keep the project, then run:

```bash
git clone --branch codex/local-mvp https://github.com/JimmyChen02/Lapwise.git
cd Lapwise
bash start.sh
```

The MVP currently lives on the `local-mvp` branch. HTTPS cloning does not require an SSH key; GitHub access is still required if the repository is private.

Already cloned the project? Open its `Lapwise` folder in VS Code, choose **Terminal → New Terminal**, and run `bash start.sh`. All commands below are run from the repository root—the folder containing `start.sh`.

The startup script creates a local Python environment, installs dependencies, builds the frontend, and starts both the app and API. The first setup requires internet access and may take a few minutes.

When the terminal says **Uvicorn running**, open:

- [Lapwise app](http://127.0.0.1:8000)
- [Interactive API docs](http://127.0.0.1:8000/docs)
- [Health check](http://127.0.0.1:8000/health)

Keep the terminal open while using the app. Press **Ctrl+C** to stop it. No API keys, database server, or cloud deployment are needed.

### Start again without reinstalling

After the first successful setup, run this from the `Lapwise` folder:

```bash
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

This uses the existing build and works offline. If you change frontend code, run `npm --prefix frontend run build` and refresh the browser, or use the development workflow below.

### Troubleshooting

- **Port 8000 already in use:** stop the other server, or run `PORT=8001 bash start.sh` and open http://127.0.0.1:8001.
- **Python or npm command not found:** install the prerequisites, reopen your terminal, and check `python3 --version` and `node --version`.
- **Cannot find start.sh:** change into the cloned `Lapwise` folder first, or open that folder in VS Code and create a new terminal.
- **Browser cannot connect:** wait for startup to finish and leave the server terminal running. Check it for errors.
- **Moved the project after setup:** recreate its `.venv` with `python3 -m venv --clear .venv`, then run `bash start.sh` to reinstall dependencies. Virtual environments contain location-specific paths.

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

Install dependencies using `bash start.sh` once, then stop it. Run two terminals from the repository root:

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
- Changes to CSVs require a backend restart because the catalog is cached in memory.
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
tests/test_api.py     API regression and integration tests
docs/API.md           Original API design and examples
start.sh              One-command setup, build, and local server
```
