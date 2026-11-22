"""The API endpoints for laptop recommendations."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .data import get_catalog
from .schemas import (
    OS_VALUES,
    PORTABILITY_VALUES,
    SCREEN_VALUES,
    USAGE_VALUES,
    Metadata,
    RecommendationRequest,
    RecommendationResponse,
)
from .scoring import recommend

app = FastAPI(
    title="Laptop Recommendation API",
    description="Recommends laptops for college students based on a short survey.",
    version="1.0.0",
)

# Allow local frontends to call the API, whatever port they're using
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# Turn request validation errors into the format the frontend expects
def _choices(values) -> str:
    values = list(values)
    return ", ".join(values[:-1]) + f", or {values[-1]}"


# Short messages for invalid survey answers
FIELD_MESSAGES = {
    "major": "Major is required.",
    "operating_system": f"Unsupported operating system. Choose {_choices(OS_VALUES)}.",
    "usage": f"Invalid usage. Provide at least one of: {', '.join(USAGE_VALUES)}.",
    "screen_size_preference": f"Invalid screen size. Choose {_choices(SCREEN_VALUES)}.",
    "portability": f"Invalid portability preference. Choose {_choices(PORTABILITY_VALUES)}.",
    "allow_chromebooks": "allow_chromebooks must be true or false.",
}


def _message_for(field: str, err_type: str) -> str:
    if err_type == "missing":
        return "This field is required."
    if field == "budget_usd":
        if err_type == "greater_than":
            return "Budget must be greater than 0."
        return "Budget must be a number greater than 0."
    if field == "storage_preference_gb":
        if err_type == "greater_than":
            return "Storage preference must be greater than 0."
        return "Storage preference must be a whole number greater than 0."
    return FIELD_MESSAGES.get(field, "Invalid value.")


@app.exception_handler(RequestValidationError)
async def survey_validation_handler(request: Request, exc: RequestValidationError):
    errors: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for err in exc.errors():
        loc = err.get("loc", ())
        # The field name is usually the second item in loc. Bad JSON has no field
        field = str(loc[1]) if len(loc) > 1 and isinstance(loc[1], str) else "body"
        message = (
            "Request body must be valid JSON."
            if err.get("type") == "json_invalid"
            else _message_for(field, err.get("type", ""))
        )
        if (field, message) not in seen:
            seen.add((field, message))
            errors.append({"field": field, "error": message})

    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "error_code": "INVALID_SURVEY_INPUT",
            "message": "Your survey contains invalid answers.",
            "recommendations": [],
            "validation_errors": errors,
        },
    )


# API routes
@app.post(
    "/api/v1/recommendations",
    response_model=RecommendationResponse,
    response_model_exclude_none=False,
    summary="Get laptop recommendations",
)
def get_recommendations(req: RecommendationRequest) -> RecommendationResponse:
    catalog = get_catalog()
    result = recommend(catalog, req)

    return RecommendationResponse(
        request_id=str(uuid.uuid4()),
        status=result.status,  # type: ignore[arg-type]
        recommendation_count=len(result.recommendations),
        recommendations=result.recommendations,
        metadata=Metadata(
            laptops_in_dataset=len(catalog.all_devices),
            laptops_considered=result.laptops_considered,
            price_observations=catalog.price_observations,
            price_data_start=catalog.price_data_start,
            price_data_end=catalog.price_data_end,
            price_basis=(
                "Budget is compared against each laptop's latest recorded price. "
                "Prices come from periodic observations, not live Amazon data."
            ),
        ),
        warnings=result.warnings,
    )


@app.get("/api/v1/options", summary="Allowed values for survey fields (handy for a frontend)")
def get_options():
    return {
        "operating_system": list(OS_VALUES),
        "screen_size_preference": list(SCREEN_VALUES),
        "portability": list(PORTABILITY_VALUES),
        "usage": list(USAGE_VALUES),
    }


@app.get("/health", summary="Health check")
def health():
    return {"status": "ok", "laptops_loaded": len(get_catalog().laptops)}


@app.get("/api/v1/laptops", summary="Browse the local laptop catalog")
def list_laptops():
    return {
        "price_basis": "Recorded CSV prices, not live retailer prices.",
        "laptops": [
            {
                "laptop_id": laptop.laptop_id,
                "brand": laptop.brand,
                "device_type": laptop.device_type,
                "latest_recorded_price_usd": laptop.prices.latest_price if laptop.prices else None,
                "price_record_date": laptop.prices.latest_date if laptop.prices else None,
                "price_history": {
                    "historical_low_usd": laptop.prices.low,
                    "historical_median_usd": laptop.prices.median,
                    "historical_high_usd": laptop.prices.high,
                } if laptop.prices else None,
                "specifications": {
                    "os": laptop.os, "screen_size_in": laptop.screen_size_in,
                    "cpu": laptop.cpu, "ram_gb": laptop.ram_gb,
                    "ram_estimated": laptop.ram_estimated, "storage_gb": laptop.storage_gb,
                },
                "reasons": [],
                "tradeoffs": ["RAM specification is estimated"] if laptop.ram_estimated else [],
                "amazon_url": laptop.amazon_url,
            }
            for laptop in get_catalog().laptops
        ],
    }


@app.get("/api/v1/laptops/{laptop_id}/prices", summary="Recorded price observations")
def laptop_prices(laptop_id: str):
    catalog = get_catalog()
    if not any(laptop.laptop_id == laptop_id for laptop in catalog.laptops):
        raise HTTPException(status_code=404, detail="Laptop not found.")
    return {"laptop_id": laptop_id, "observations": catalog.price_series.get(laptop_id, []), "currency": "USD"}


# Keep API routes ahead of the frontend mount. A production build needs only one server.
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
