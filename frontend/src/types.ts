export type Survey = {
  major: string;
  budget_usd: number;
  operating_system: string;
  usage: string[];
  screen_size_preference: string;
  portability: string;
  storage_preference_gb: number;
  allow_chromebooks: boolean;
};
export type Laptop = {
  laptop_id: string;
  brand: string;
  device_type: string;
  rank?: number;
  match_score?: number;
  latest_recorded_price_usd: number | null;
  price_record_date: string | null;
  price_history: {
    historical_low_usd: number;
    historical_median_usd: number;
    historical_high_usd: number;
  } | null;
  specifications: {
    os: string;
    screen_size_in: number;
    cpu: string;
    ram_gb: number;
    ram_estimated: boolean;
    storage_gb: number;
  };
  reasons: string[];
  tradeoffs: string[];
  amazon_url: string | null;
};
export type Result = {
  status: "success" | "partial" | "no_matches";
  recommendations: Laptop[];
  warnings: string[];
  metadata: {
    laptops_considered: number;
    price_observations: number;
    price_basis: string;
  };
};
export type Point = { date: string; price_usd: number };
