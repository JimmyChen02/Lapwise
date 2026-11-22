"""Load the laptop specs and price history from the CSV files."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Tablets are in the data too, but shouldn't show up as recommendations
LAPTOP_DEVICE_TYPES = {"laptop", "2_in_1", "chromebook"}


@dataclass(frozen=True)
class PriceStats:
    latest_price: float
    latest_date: str  # ISO 8601
    low: float
    median: float
    high: float
    observations: int


@dataclass(frozen=True)
class Laptop:
    laptop_id: str
    asin: Optional[str]
    amazon_url: Optional[str]
    brand: Optional[str]
    device_type: str
    os: str
    os_family: str 
    screen_size_in: float
    touchscreen: bool
    cpu: str
    ram_gb: int
    ram_estimated: bool
    storage_gb: int
    prices: Optional[PriceStats]

    @property
    def is_chromebook(self) -> bool:
        return self.device_type == "chromebook" or self.os_family == "ChromeOS"


def _clean(value):
    """Turn pandas NaN/NA into None."""
    return None if pd.isna(value) else value


def _os_family(os_name: str) -> str:
    lowered = os_name.lower()
    if lowered.startswith("windows"):
        return "Windows"
    if lowered.startswith("macos"):
        return "macOS"
    if lowered.startswith("chrome"):
        return "ChromeOS"
    return "Other"


def _build_price_stats(prices: pd.DataFrame) -> dict[str, PriceStats]:
    stats: dict[str, PriceStats] = {}
    # If dates match, use whichever row appears last in the CSV
    ordered = prices.sort_values("date", kind="stable")
    for laptop_id, group in ordered.groupby("laptop_id"):
        last = group.iloc[-1]
        stats[laptop_id] = PriceStats(
            latest_price=round(float(last["price_usd"]), 2),
            latest_date=last["date"].date().isoformat(),
            low=round(float(group["price_usd"].min()), 2),
            median=round(float(group["price_usd"].median()), 2),
            high=round(float(group["price_usd"].max()), 2),
            observations=int(len(group)),
        )
    return stats


class Catalog:
    """In-memory laptop catalog with price statistics."""

    def __init__(self, data_dir: Path = DATA_DIR):
        specs = pd.read_csv(data_dir / "specs.csv")
        prices = pd.read_csv(data_dir / "pricing_history.csv", parse_dates=["date"])
        # Keep real observations for the local price tracker, in stable date order.
        self.price_series = {
            str(laptop_id): [
                {"date": row.date.date().isoformat(), "price_usd": round(float(row.price_usd), 2)}
                for row in group.itertuples()
            ]
            for laptop_id, group in prices.sort_values("date", kind="stable").groupby("laptop_id")
        }

        self.price_observations = int(len(prices))
        self.price_data_start = prices["date"].min().date().isoformat() if len(prices) else None
        self.price_data_end = prices["date"].max().date().isoformat() if len(prices) else None

        price_stats = _build_price_stats(prices)

        self.all_devices: list[Laptop] = []
        for row in specs.to_dict(orient="records"):
            laptop_id = row["laptop_id"]
            os_name = _clean(row["os"]) or "Unknown"
            cpu_parts = [_clean(row.get("cpu_brand")), _clean(row.get("cpu_model"))]
            cpu = " ".join(str(p) for p in cpu_parts if p)
            # Joining the brand and model gives names like "Intel Core 5"
            self.all_devices.append(
                Laptop(
                    laptop_id=laptop_id,
                    asin=_clean(row.get("asin")),
                    amazon_url=_clean(row.get("amazon_url")),
                    brand=_clean(row.get("brand")),
                    device_type=_clean(row.get("device_type")) or "unknown",
                    os=os_name,
                    os_family=_os_family(os_name),
                    screen_size_in=float(row["screen_size_in"]),
                    touchscreen=bool(_clean(row.get("touchscreen")) or False),
                    cpu=cpu,
                    ram_gb=int(row["ram_gb"]),
                    ram_estimated=bool(_clean(row.get("ram_estimated")) or False),
                    storage_gb=int(row["storage_gb"]),
                    prices=price_stats.get(laptop_id),
                )
            )

        self.laptops: list[Laptop] = [
            d for d in self.all_devices if d.device_type in LAPTOP_DEVICE_TYPES
        ]


_catalog: Optional[Catalog] = None


def get_catalog() -> Catalog:
    """Get the shared catalog, loading it the first time it's needed."""
    global _catalog
    if _catalog is None:
        _catalog = Catalog()
    return _catalog
