"""Request and response shapes used by the API."""
from __future__ import annotations

from typing import Annotated, Literal, Optional, get_args

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Keep the allowed values here so validation and the options endpoint agree
OperatingSystem = Literal["Windows", "macOS", "ChromeOS", "no_preference"]
ScreenSizePreference = Literal["13-14", "15-16", "no_preference"]
Portability = Literal["low", "medium", "high"]
UsageType = Literal[
    "programming",
    "schoolwork",
    "engineering_software",
    "data_science",
    "creative_work",
    "web_browsing",
]

OS_VALUES = get_args(OperatingSystem)
SCREEN_VALUES = get_args(ScreenSizePreference)
PORTABILITY_VALUES = get_args(Portability)
USAGE_VALUES = get_args(UsageType)


# Answers submitted by the survey
class RecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    major: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    budget_usd: float = Field(gt=0)
    operating_system: OperatingSystem
    usage: list[UsageType] = Field(min_length=1)
    screen_size_preference: ScreenSizePreference
    portability: Portability
    storage_preference_gb: int = Field(gt=0)
    allow_chromebooks: bool


# Parts of the recommendation response
class PriceHistory(BaseModel):
    historical_low_usd: float
    historical_median_usd: float
    historical_high_usd: float


class Specifications(BaseModel):
    os: str
    screen_size_in: float
    cpu: str
    ram_gb: int
    ram_estimated: bool = False  # True when the RAM value is an estimate, not a confirmed spec
    storage_gb: int


class LaptopRecommendation(BaseModel):
    rank: int
    laptop_id: str
    match_score: float = Field(ge=0, le=100)
    latest_recorded_price_usd: Optional[float]
    price_record_date: Optional[str]  # ISO 8601 date
    price_history: Optional[PriceHistory]
    specifications: Specifications
    reasons: list[str]
    tradeoffs: list[str]
    reason_codes: list[str]
    amazon_url: Optional[str]


class Metadata(BaseModel):
    laptops_in_dataset: int
    laptops_considered: int
    price_observations: int
    price_data_start: Optional[str]
    price_data_end: Optional[str]
    currency: str = "USD"
    price_basis: str


class RecommendationResponse(BaseModel):
    request_id: str
    status: Literal["success", "partial", "no_matches"]
    recommendation_count: int
    recommendations: list[LaptopRecommendation]
    metadata: Metadata
    warnings: list[str] = []
