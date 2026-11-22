"""Score the laptops that fit a student's survey

Some laptops get filtered out first (wrong OS, over budget, etc). The rest
get a score from the rules below. The remaining weights are scaled to 100;
tweak those or the rules if the rankings need adjusting
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from .data import Catalog, Laptop
from .schemas import (
    LaptopRecommendation,
    PriceHistory,
    RecommendationRequest,
    Specifications,
)

MAX_RESULTS = 3
STALE_PRICE_DAYS = 60

# Relative weights for each rule; these get scaled to make a score out of 100
WEIGHTS = {
    "os": 10,
    "price": 32,
    "screen": 8,
    "ram": 12,
    "storage": 12,
    "portability": 8,
    "compat": 7,
    "value": 5,
}
WEIGHT_TOTAL = sum(WEIGHTS.values())

RAM_HUNGRY_USES = {"programming", "data_science", "engineering_software", "creative_work"}
# Some majors need more RAM even if programming wasn't selected
STEM_MAJOR_KEYWORDS = ("computer", "engineering", "data", "software", "math", "physics", "statistics")

# Screen sizes for the survey's two size options
SCREEN_RANGES = {"13-14": (13.0, 14.5), "15-16": (15.0, 16.5)}


# Each rule gives a score and, sometimes, a reason or tradeoff to show
@dataclass
class RuleResult:
    fraction: float  # 0.0 - 1.0
    reasons: list[tuple[str, str]] = field(default_factory=list)  # (code, text)
    tradeoffs: list[tuple[str, str]] = field(default_factory=list)  # (code, text)


@dataclass
class UserNeeds:
    """The request, boiled down to the things the rules actually need."""

    req: RecommendationRequest
    ram_needed_gb: int
    ram_reason_suffix: str


def _storage_label(gb: int) -> str:
    if gb >= 1024 and gb % 1024 == 0:
        return f"{gb // 1024} TB"
    return f"{gb} GB"


# Work out what the student is looking for
def build_needs(req: RecommendationRequest) -> UserNeeds:
    uses = set(req.usage)

    # RAM requirement
    stem_major = any(k in req.major.lower() for k in STEM_MAJOR_KEYWORDS)
    ram_uses = [u for u in req.usage if u in RAM_HUNGRY_USES]
    needs_16 = bool(ram_uses) or stem_major
    ram_needed = 16 if needs_16 else 8

    if "programming" in uses:
        suffix = "programming and multitasking"
    elif "data_science" in uses:
        suffix = "data science and multitasking"
    elif "creative_work" in uses:
        suffix = "creative work and multitasking"
    else:
        suffix = "multitasking"

    return UserNeeds(req, ram_needed, suffix)


# The rules are kept small so each preference can be scored on its own
def rule_os(laptop: Laptop, n: UserNeeds) -> RuleResult:
    pref = n.req.operating_system
    if pref == "no_preference":
        return RuleResult(1.0)
    if laptop.os_family == pref:
        return RuleResult(1.0, reasons=[("OS_MATCH", f"Matches your {pref} preference")])
    return RuleResult(0.0, tradeoffs=[("OS_MISMATCH", f"Does not run {pref}")])


def rule_price(laptop: Laptop, n: UserNeeds) -> RuleResult:
    """Within budget is the baseline; more headroom under budget scores higher."""
    if laptop.prices is None:
        return RuleResult(0.0, tradeoffs=[("PRICE_UNKNOWN", "No price data available")])
    budget = n.req.budget_usd
    price = laptop.prices.latest_price
    headroom = max(0.0, 1.0 - price / budget)
    fraction = 0.6 + 0.4 * headroom
    return RuleResult(fraction, reasons=[("WITHIN_BUDGET", "Within your budget")])


def rule_screen(laptop: Laptop, n: UserNeeds) -> RuleResult:
    pref = n.req.screen_size_preference
    if pref == "no_preference":
        return RuleResult(1.0)
    low, high = SCREEN_RANGES[pref]
    size = laptop.screen_size_in
    if low <= size <= high:
        return RuleResult(1.0, reasons=[("SCREEN_MATCH", "Matches your preferred screen size")])
    if size > high:
        return RuleResult(0.4, tradeoffs=[("SCREEN_LARGER", "Larger than your preferred screen size")])
    return RuleResult(0.4, tradeoffs=[("SCREEN_SMALLER", "Smaller than your preferred screen size")])


def rule_ram(laptop: Laptop, n: UserNeeds) -> RuleResult:
    ram, need = laptop.ram_gb, n.ram_needed_gb
    reasons: list[tuple[str, str]] = []
    tradeoffs: list[tuple[str, str]] = []

    if ram >= need:
        if need == 16:
            reasons.append(("RAM_SUFFICIENT", f"Has {ram} GB RAM for {n.ram_reason_suffix}"))
        else:
            reasons.append(("RAM_SUFFICIENT", f"Has {ram} GB RAM, plenty for your uses"))
        fraction = 1.0
    else:
        fraction = 0.4 if ram >= 8 else 0.2
        tradeoffs.append(("RAM_LOW", f"Only {ram} GB RAM"))

    if laptop.ram_estimated:
        tradeoffs.append(("RAM_ESTIMATED", "RAM specification is estimated"))
    return RuleResult(fraction, reasons, tradeoffs)


def rule_storage(laptop: Laptop, n: UserNeeds) -> RuleResult:
    pref = n.req.storage_preference_gb
    have = laptop.storage_gb
    if have >= pref * 2:
        return RuleResult(
            1.0, reasons=[("STORAGE_AMPLE", f"Provides {_storage_label(have)} of storage")]
        )
    if have >= pref:
        return RuleResult(1.0, reasons=[("STORAGE_MEETS", "Meets your storage preference")])
    return RuleResult(
        have / pref,
        tradeoffs=[("STORAGE_LOW", "Has less storage than your preference")],
    )


def rule_portability(laptop: Laptop, n: UserNeeds) -> RuleResult:
    """The dataset has no weight data, so screen size is the portability proxy."""
    importance = n.req.portability
    size = laptop.screen_size_in
    if importance == "low":
        return RuleResult(1.0)

    if size <= 14.5:
        score = 1.0
    elif size <= 15.5:
        score = 0.6
    else:
        score = 0.3

    if importance == "medium":
        score = 0.5 + 0.5 * score  # medium cares about it, but less

    reasons: list[tuple[str, str]] = []
    tradeoffs: list[tuple[str, str]] = []
    if score == 1.0 and importance == "high":
        reasons.append(("PORTABLE", "Compact and easy to carry"))
    elif score < 0.8 and importance == "high" and n.req.screen_size_preference == "no_preference":
        # If the user already got a screen-size tradeoff we don't repeat the point
        tradeoffs.append(("LESS_PORTABLE", "Larger screen makes it less portable"))
    return RuleResult(score, reasons, tradeoffs)


def rule_compat(laptop: Laptop, n: UserNeeds) -> RuleResult:
    """Software compatibility for coursework (engineering tools, dev tools)."""
    uses = set(n.req.usage)
    fraction = 1.0
    tradeoffs: list[tuple[str, str]] = []

    if "engineering_software" in uses:
        if laptop.os_family == "macOS":
            fraction = min(fraction, 0.4)
            tradeoffs.append(
                ("ENG_SOFTWARE_MAC", "Some engineering software (e.g. SolidWorks) is Windows-only")
            )
        elif laptop.os_family == "ChromeOS":
            fraction = min(fraction, 0.0)
            tradeoffs.append(
                ("ENG_SOFTWARE_CHROMEOS", "Cannot run most engineering software")
            )

    if uses & {"programming", "data_science"} and laptop.os_family == "ChromeOS":
        fraction = min(fraction, 0.4)
        tradeoffs.append(("DEV_TOOLS_CHROMEOS", "Limited support for development tools on ChromeOS"))

    return RuleResult(fraction, tradeoffs=tradeoffs)


def rule_value(laptop: Laptop, n: UserNeeds) -> RuleResult:
    p = laptop.prices
    if p is not None and p.latest_price < p.median:
        return RuleResult(
            1.0, reasons=[("PRICE_BELOW_MEDIAN", "Latest recorded price is below its historical median")]
        )
    return RuleResult(0.0)


RULES = {
    "os": rule_os,
    "price": rule_price,
    "screen": rule_screen,
    "ram": rule_ram,
    "storage": rule_storage,
    "portability": rule_portability,
    "compat": rule_compat,
    "value": rule_value,
}


# Filter first, then score and rank what's left
@dataclass
class ScoredLaptop:
    laptop: Laptop
    score: float
    reasons: list[tuple[str, str]]
    tradeoffs: list[tuple[str, str]]


def score_laptop(laptop: Laptop, needs: UserNeeds) -> ScoredLaptop:
    total = 0.0
    reasons: list[tuple[str, str]] = []
    tradeoffs: list[tuple[str, str]] = []
    for name, rule in RULES.items():
        result = rule(laptop, needs)
        total += WEIGHTS[name] * max(0.0, min(1.0, result.fraction))
        reasons.extend(result.reasons)
        tradeoffs.extend(result.tradeoffs)
    total = total * 100 / WEIGHT_TOTAL

    # Mention the touchscreen, but don't add points for it
    if laptop.device_type == "2_in_1" and laptop.touchscreen:
        reasons.append(("TOUCHSCREEN_2IN1", "Touchscreen provides additional flexibility"))

    return ScoredLaptop(laptop, total, reasons, tradeoffs)


@dataclass
class EngineOutput:
    status: str
    recommendations: list[LaptopRecommendation]
    warnings: list[str]
    laptops_considered: int


def _apply_hard_filters(
    catalog: Catalog, req: RecommendationRequest, warnings: list[str]
) -> tuple[list[Laptop], bool]:
    """Returns (candidates, used_unpriced). used_unpriced is True if we kept
    laptops whose budget fit could not be verified."""
    candidates = list(catalog.laptops)

    if not req.allow_chromebooks:
        candidates = [c for c in candidates if not c.is_chromebook]
        if req.operating_system == "ChromeOS":
            warnings.append(
                "You selected ChromeOS but set allow_chromebooks to false, so no Chromebooks were considered."
            )

    if req.operating_system != "no_preference":
        candidates = [c for c in candidates if c.os_family == req.operating_system]

    in_budget: list[Laptop] = []
    used_unpriced = False
    for c in candidates:
        if c.prices is None:
            used_unpriced = True
            warnings.append(f"{c.laptop_id} has no price data, so its budget fit could not be verified.")
            in_budget.append(c)
        elif c.prices.latest_price <= req.budget_usd:
            in_budget.append(c)
    return in_budget, used_unpriced


def recommend(catalog: Catalog, req: RecommendationRequest, today: Optional[date] = None) -> EngineOutput:
    today = today or date.today()
    needs = build_needs(req)
    warnings: list[str] = []
    candidates, used_unpriced = _apply_hard_filters(catalog, req, warnings)

    if not candidates:
        return EngineOutput("no_matches", [], warnings, 0)

    scored = [score_laptop(c, needs) for c in candidates]
    # Sort by score, then price, then name so ties are predictable
    scored.sort(
        key=lambda s: (
            -round(s.score),
            s.laptop.prices.latest_price if s.laptop.prices else float("inf"),
            s.laptop.laptop_id,
        )
    )
    top = scored[:MAX_RESULTS]

    recs: list[LaptopRecommendation] = []
    top_price = top[0].laptop.prices.latest_price if top[0].laptop.prices else None
    for rank, s in enumerate(top, start=1):
        lap = s.laptop
        reasons = list(s.reasons)

        # Call out a much cheaper option if it's lower in the rankings
        if (
            rank > 1
            and top_price
            and lap.prices
            and lap.prices.latest_price <= 0.75 * top_price
        ):
            reasons.append(("LOWER_COST_ALTERNATIVE", "Offers a lower-cost alternative"))

        price_history = None
        if lap.prices:
            price_history = PriceHistory(
                historical_low_usd=lap.prices.low,
                historical_median_usd=lap.prices.median,
                historical_high_usd=lap.prices.high,
            )
            age = (today - date.fromisoformat(lap.prices.latest_date)).days
            if age > STALE_PRICE_DAYS:
                warnings.append(
                    f"The latest recorded price for {lap.laptop_id} is {age} days old "
                    f"({lap.prices.latest_date}); check Amazon for the current price."
                )
        if lap.ram_estimated:
            warnings.append(f"The RAM for {lap.laptop_id} is an estimate, not a confirmed spec.")

        recs.append(
            LaptopRecommendation(
                rank=rank,
                laptop_id=lap.laptop_id,
                match_score=round(s.score),
                latest_recorded_price_usd=lap.prices.latest_price if lap.prices else None,
                price_record_date=lap.prices.latest_date if lap.prices else None,
                price_history=price_history,
                specifications=Specifications(
                    os=lap.os,
                    screen_size_in=lap.screen_size_in,
                    cpu=lap.cpu,
                    ram_gb=lap.ram_gb,
                    ram_estimated=lap.ram_estimated,
                    storage_gb=lap.storage_gb,
                ),
                reasons=[text for _, text in reasons],
                tradeoffs=[text for _, text in s.tradeoffs],
                reason_codes=[code for code, _ in reasons] + [code for code, _ in s.tradeoffs],
                amazon_url=lap.amazon_url,
            )
        )

    # Results can still be useful even if a need can't be verified or met
    partial = used_unpriced

    return EngineOutput("partial" if partial else "success", recs, warnings, len(candidates))
