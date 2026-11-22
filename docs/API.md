# Laptop Recommendation API

FastAPI backend for the laptop-recommendation survey

## Setup

### Mac

```bash
pip3 install -r requirements.txt
```

### Windows

```powershell
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload
```

- API: http://127.0.0.1:8000

## Endpoints

| Method | Path                       | Purpose                                         |
|--------|----------------------------|-------------------------------------------------|
| POST   | `/api/v1/recommendations`  | Submit the survey, get ranked laptops           |
| GET    | `/api/v1/options`          | Allowed enum values (for building form inputs)  |
| GET    | `/health`                  | Health check                                    |

Invalid input returns HTTP 422 with `error_code: INVALID_SURVEY_INPUT` and a
`validation_errors` list, as in the spec.

## Try a recommendation request

**Terminal 1: start the server** (from the `laptop_api` folder)

```bash
uvicorn app.main:app --reload
```

Leave it running. It logs each request you send.

**Terminal 2: send a request with curl**

```bash
curl -X POST http://127.0.0.1:8000/api/v1/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "major": "Computer Science",
    "budget_usd": 1300,
    "operating_system": "Windows",
    "usage": ["programming", "schoolwork"],
    "screen_size_preference": "13-14",
    "portability": "high",
    "storage_preference_gb": 512,
    "allow_chromebooks": false
  }'
```

The endpoint returns JSON with ranked recommendations. Here is a sample response:

```json
{
  "request_id": "8071c02f-2a9f-40ea-b782-b0526dff85ca",
  "status": "success",
  "recommendation_count": 3,
  "recommendations": [
    {
      "rank": 1,
      "laptop_id": "Acer Aspire Go 16",
      "match_score": 81.0,
      "latest_recorded_price_usd": 619.99,
      "price_record_date": "2026-09-18",
      "price_history": {
        "historical_low_usd": 579.99,
        "historical_median_usd": 619.99,
        "historical_high_usd": 649.99
      },
      "specifications": {
        "os": "Windows 11 Pro",
        "screen_size_in": 16.0,
        "cpu": "Intel Core 7",
        "ram_gb": 16,
        "ram_estimated": false,
        "storage_gb": 1024
      },
      "reasons": [
        "Matches your Windows preference",
        "Within your budget",
        "Has 16 GB RAM for programming and multitasking",
        "Provides 1 TB of storage"
      ],
      "tradeoffs": [
        "Larger than your preferred screen size"
      ],
      "reason_codes": [
        "OS_MATCH",
        "WITHIN_BUDGET",
        "RAM_SUFFICIENT",
        "STORAGE_AMPLE",
        "SCREEN_LARGER"
      ],
      "amazon_url": "https://www.amazon.com/dp/B0FRNM3RMQ"
    },
    {
      "rank": 2,
      "laptop_id": "Lenovo Yoga 7i",
      "match_score": 79.0,
      "latest_recorded_price_usd": 1145.0,
      "price_record_date": "2026-10-02",
      "price_history": {
        "historical_low_usd": 1084.08,
        "historical_median_usd": 1095.0,
        "historical_high_usd": 1299.0
      },
      "specifications": {
        "os": "Windows 11 Pro",
        "screen_size_in": 16.0,
        "cpu": "Intel Core Ultra 5",
        "ram_gb": 16,
        "ram_estimated": false,
        "storage_gb": 512
      },
      "reasons": [
        "Matches your Windows preference",
        "Within your budget",
        "Has 16 GB RAM for programming and multitasking",
        "Meets your storage preference",
        "Touchscreen provides additional flexibility"
      ],
      "tradeoffs": [
        "Larger than your preferred screen size"
      ],
      "reason_codes": [
        "OS_MATCH",
        "WITHIN_BUDGET",
        "RAM_SUFFICIENT",
        "STORAGE_MEETS",
        "TOUCHSCREEN_2IN1",
        "SCREEN_LARGER"
      ],
      "amazon_url": "https://www.amazon.com/dp/B0GHWSWMHQ"
    },
    {
      "rank": 3,
      "laptop_id": "Dell XPS 13",
      "match_score": 77.0,
      "latest_recorded_price_usd": 849.99,
      "price_record_date": "2026-09-25",
      "price_history": {
        "historical_low_usd": 799.99,
        "historical_median_usd": 1199.99,
        "historical_high_usd": 1798.99
      },
      "specifications": {
        "os": "Windows 11 Pro",
        "screen_size_in": 13.4,
        "cpu": "Intel Core 5",
        "ram_gb": 8,
        "ram_estimated": true,
        "storage_gb": 512
      },
      "reasons": [
        "Matches your Windows preference",
        "Within your budget",
        "Matches your preferred screen size",
        "Meets your storage preference",
        "Compact and easy to carry",
        "Latest recorded price is below its historical median"
      ],
      "tradeoffs": [
        "Only 8 GB RAM",
        "RAM specification is estimated"
      ],
      "reason_codes": [
        "OS_MATCH",
        "WITHIN_BUDGET",
        "SCREEN_MATCH",
        "STORAGE_MEETS",
        "PORTABLE",
        "PRICE_BELOW_MEDIAN",
        "RAM_LOW",
        "RAM_ESTIMATED"
      ],
      "amazon_url": "https://www.amazon.com/dp/B0FKSV6KQH"
    }
  ],
  "metadata": {
    "laptops_in_dataset": 8,
    "laptops_considered": 3,
    "price_observations": 549,
    "price_data_start": "2025-03-04",
    "price_data_end": "2026-10-02",
    "currency": "USD",
    "price_basis": "Budget is compared against each laptop's latest recorded price. Prices come from periodic observations, not live Amazon data."
  },
  "warnings": [
    "The latest recorded price for Acer Aspire Go 16 is 64 days old (2026-09-18); check Amazon for the current price.",
    "The RAM for Dell XPS 13 is an estimate, not a confirmed spec."
  ]
}
```

## Project layout

```
app/
  main.py      FastAPI app, endpoints, validation-error formatting
  schemas.py   Request/response models (the spec, as code)
  data.py      Loads the CSVs, computes latest/low/median/high prices
  scoring.py   Filters + scoring rules  (tune weights here)
data/
  specs.csv, pricing_history.csv
tests/
  test_api.py
```

## How recommendations work

1. **Hard filters**: tablets are never recommended; Chromebooks are removed
   unless `allow_chromebooks` is true; a specific OS preference must match;
   the *latest recorded price* must be within budget.
2. **Scoring**: each remaining laptop is scored by small rules (OS, price
   headroom, screen size, RAM, storage, portability, software compatibility,
   value vs. median). Each rule adds reason or tradeoff text and a `reason_code`.
   The remaining weights are scaled to make the final score out of 100.
3. **Top 3** are returned, ranked by score.

### Status values
- `success`: results returned, nothing questionable.
- `partial`: results returned, but some price data is missing, so the budget
  fit couldn't be verified.
- `no_matches`: nothing passed the hard filters.
