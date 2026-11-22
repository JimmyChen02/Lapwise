import { useEffect, useMemo, useState } from "react";
import {
  Laptop as LaptopIcon,
  Search,
  Bookmark,
  Heart,
  SlidersHorizontal,
  Check,
  X,
  BarChart3,
  Leaf,
  Monitor,
  Cpu,
  HardDrive,
  Info,
  Bell,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { api } from "./api";
import type { Laptop, Result, Survey as SurveyType } from "./types";
import Survey from "./Survey";
import {
  dateLabel,
  DealSummary,
  LaptopArt,
  Modal,
  money,
  PriceChart,
  Reasons,
  storage,
  useStored,
} from "./components";

type Page = "discover" | "survey" | "saved" | "tracker";
type Filters = {
  max: number;
  brands: string[];
  ram: number[];
  screen: string;
  deals: boolean;
};
const initialFilters: Filters = {
  max: 5000,
  brands: [],
  ram: [],
  screen: "all",
  deals: false,
};
const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const isTargets = (v: unknown): v is Record<string, number> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.values(v).every(
    (x) => typeof x === "number" && Number.isFinite(x) && x > 0,
  );
const isSurvey = (v: unknown): v is SurveyType | null => {
  if (v === null) return true;
  if (!v || typeof v !== "object") return false;
  const s = v as SurveyType;
  return (
    typeof s.major === "string" &&
    s.major.trim().length > 0 &&
    typeof s.budget_usd === "number" &&
    Number.isFinite(s.budget_usd) &&
    s.budget_usd > 0 &&
    ["no_preference", "Windows", "macOS", "ChromeOS"].includes(
      s.operating_system,
    ) &&
    isStrings(s.usage) &&
    s.usage.length > 0 &&
    s.usage.every((u) =>
      [
        "programming",
        "schoolwork",
        "engineering_software",
        "data_science",
        "creative_work",
        "web_browsing",
      ].includes(u),
    ) &&
    ["13-14", "15-16", "no_preference"].includes(s.screen_size_preference) &&
    ["low", "medium", "high"].includes(s.portability) &&
    Number.isInteger(s.storage_preference_gb) &&
    s.storage_preference_gb > 0 &&
    typeof s.allow_chromebooks === "boolean"
  );
};
export default function App() {
  const [page, setPage] = useState<Page>("discover"),
    [catalog, setCatalog] = useState<Laptop[]>([]),
    [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [surveyError, setSurveyError] = useState(""),
    [retry, setRetry] = useState(0);
  const [preferences, setPreferences] = useStored<SurveyType | null>(
      "lapwise.preferences.v1",
      null,
      isSurvey,
    ),
    [saved, setSaved] = useStored<string[]>("lapwise.saved.v1", [], isStrings),
    [targets, setTargets] = useStored<Record<string, number>>(
      "lapwise.targets.v1",
      {},
      isTargets,
    );
  const [search, setSearch] = useState(""),
    [filters, setFilters] = useState(initialFilters),
    [filterOpen, setFilterOpen] = useState(false),
    [sort, setSort] = useState("match"),
    [category, setCategory] = useState("all"),
    [detail, setDetail] = useState<Laptop | null>(null),
    [compare, setCompare] = useState<string[]>([]),
    [comparison, setComparison] = useState(false),
    [targetLaptop, setTargetLaptop] = useState<Laptop | null>(null),
    [targetValue, setTargetValue] = useState(""),
    [how, setHow] = useState(false),
    [notice, setNotice] = useState(""),
    [trackerId, setTrackerId] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.catalog(),
      preferences ? api.recommend(preferences) : Promise.resolve(null),
    ])
      .then(([data, recommendations]) => {
        if (active) {
          setCatalog(data.laptops);
          setResult(recommendations);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "Cannot connect to the local API.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry, preferences]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  const enriched = useMemo(
    () =>
      catalog.map((l) => ({
        ...l,
        ...result?.recommendations.find((r) => r.laptop_id === l.laptop_id),
      })),
    [catalog, result],
  );
  const source =
    page === "saved"
      ? enriched.filter((l) => saved.includes(l.laptop_id))
      : result
        ? result.recommendations.map((r) => ({
            ...catalog.find((l) => l.laptop_id === r.laptop_id)!,
            ...r,
          }))
        : enriched;
  const visible = useMemo(
    () =>
      source
        .filter((l) => {
          const spec = l.specifications;
          return (
            `${l.laptop_id} ${spec.cpu} ${spec.os} ${spec.ram_gb} GB`
              .toLowerCase()
              .includes(search.toLowerCase()) &&
            (filters.max === 5000 ||
              l.latest_recorded_price_usd == null ||
              l.latest_recorded_price_usd <= filters.max) &&
            (!filters.brands.length || filters.brands.includes(l.brand)) &&
            (!filters.ram.length || filters.ram.includes(spec.ram_gb)) &&
            (filters.screen === "all" ||
              (filters.screen === "compact"
                ? spec.screen_size_in <= 14.5
                : spec.screen_size_in > 14.5)) &&
            (!(filters.deals || category === "deals") ||
              (l.price_history &&
                l.latest_recorded_price_usd != null &&
                l.latest_recorded_price_usd <
                  l.price_history.historical_median_usd))
          );
        })
        .sort((a, b) => {
          if (sort === "price" || category === "value")
            return (
              (a.latest_recorded_price_usd ?? Infinity) -
              (b.latest_recorded_price_usd ?? Infinity)
            );
          if (sort === "price-desc")
            return (
              (b.latest_recorded_price_usd ?? -Infinity) -
              (a.latest_recorded_price_usd ?? -Infinity)
            );
          return (
            (b.match_score ?? 0) - (a.match_score ?? 0) ||
            a.laptop_id.localeCompare(b.laptop_id)
          );
        }),
    [source, search, filters, sort, category],
  );
  const selectedTracker =
    enriched.find((l) => l.laptop_id === trackerId) ||
    enriched.find((l) => Object.hasOwn(targets, l.laptop_id)) ||
    enriched[0];
  function navigate(next: Page) {
    setPage(next);
    setSurveyError("");
    setFilterOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleSave(id: string) {
    setSaved((old) =>
      old.includes(id) ? old.filter((s) => s !== id) : [...old, id],
    );
    setNotice(
      saved.includes(id)
        ? "Laptop removed from saved."
        : "Laptop saved in this browser.",
    );
  }
  function toggleCompare(id: string) {
    if (compare.includes(id)) setCompare((old) => old.filter((s) => s !== id));
    else if (compare.length < 3) setCompare((old) => [...old, id]);
    else setNotice("Compare up to three laptops at a time.");
  }
  async function submit(s: SurveyType) {
    setBusy(true);
    setSurveyError("");
    try {
      const r = await api.recommend(s);
      setResult(r);
      setPreferences(s);
      setFilters(initialFilters);
      setSearch("");
      setCategory("all");
      navigate("discover");
    } catch (e) {
      setSurveyError(
        e instanceof Error
          ? e.message
          : "Could not find matches. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  function openTarget(l: Laptop) {
    setTargetLaptop(l);
    setTargetValue(
      String(
        targets[l.laptop_id] ||
          Math.floor((l.latest_recorded_price_usd || 1000) * 0.9),
      ),
    );
  }
  function filterArray(key: "brands" | "ram", value: string | number) {
    setFilters((old) => ({
      ...old,
      [key]: old[key].includes(value as never)
        ? old[key].filter((v) => v !== value)
        : [...old[key], value],
    }));
  }
  const activeFilters =
    filters.brands.length +
    filters.ram.length +
    (filters.screen !== "all" ? 1 : 0) +
    (filters.deals ? 1 : 0) +
    (filters.max < 5000 ? 1 : 0);
  const top = visible[0];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate("discover")}
            aria-label="Lapwise home"
          >
            <span className="brand-icon">
              <LaptopIcon size={21} />
            </span>
            lapwise<span className="brand-period">.</span>
          </button>
          <nav aria-label="Main navigation">
            <button
              className={page === "discover" ? "current" : ""}
              onClick={() => navigate("discover")}
            >
              Discover
            </button>
            <button
              className={page === "tracker" ? "current" : ""}
              onClick={() => navigate("tracker")}
            >
              Price tracker
            </button>
            <button onClick={() => setHow(true)}>How it works</button>
          </nav>
          <label className="header-search">
            <Search size={17} />
            <input
              aria-label="Search laptops, brands, or specs"
              placeholder="Search laptops, brands, or specs"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (page !== "discover" && page !== "saved")
                  navigate("discover");
              }}
            />
          </label>
          <button
            className={`saved-nav ${page === "saved" ? "selected" : ""}`}
            onClick={() => navigate("saved")}
          >
            <Bookmark size={17} /> Saved
            {saved.length > 0 && <span>{saved.length}</span>}
          </button>
          <button
            className="button primary header-survey"
            onClick={() => navigate("survey")}
          >
            {preferences ? "My preferences" : "Find my laptop"}
          </button>
        </div>
      </header>
      <main id="main" className={page === "survey" ? "survey-main" : "main"}>
        {page === "survey" ? (
          <Survey
            initial={preferences}
            onSubmit={submit}
            busy={busy}
            error={surveyError}
            onCancel={() => navigate("discover")}
          />
        ) : (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">LESS GUESSWORK. BETTER LAPTOPS.</p>
                <h1>
                  {page === "saved"
                    ? "A shortlist worth keeping."
                    : page === "tracker"
                      ? "A little timing. A better deal."
                      : "Your next laptop, wisely chosen."}
                </h1>
                <p className="intro">
                  {page === "saved"
                    ? "Your favorites, ready when you are. Saved locally in this browser."
                    : page === "tracker"
                      ? "Put recorded prices in perspective, and keep your target in sight."
                      : "Recommendations that fit your life. Prices that make sense."}
                </p>
              </div>
              <div className="hero-note">
                <Leaf size={22} />
                <div>
                  <strong>Made for your next chapter</strong>
                  <span>
                    {catalog.length
                      ? `${catalog.length} laptops in your local catalog`
                      : "A thoughtful way to choose"}
                  </span>
                </div>
              </div>
            </section>
            {page === "discover" && (
              <section
                className="preference-strip"
                aria-label="Your preferences"
              >
                <div>
                  <span className="eyebrow">YOUR PREFERENCES</span>
                  <p>
                    {preferences
                      ? "A little about you goes a long way."
                      : "A better match starts with you."}
                  </p>
                </div>
                <div className="preference-chips">
                  <span>{preferences?.major || "Work & everyday"}</span>
                  <span>
                    {preferences
                      ? `Up to ${money(preferences.budget_usd)}`
                      : "Your budget"}
                  </span>
                  <span>
                    {preferences?.operating_system === "no_preference"
                      ? "Any operating system"
                      : preferences?.operating_system || "Your software"}
                  </span>
                  <span>
                    {preferences?.portability === "high"
                      ? "Light & portable"
                      : "Your everyday needs"}
                  </span>
                </div>
                <button
                  className="button primary"
                  onClick={() => navigate("survey")}
                >
                  {preferences ? "Edit preferences" : "Take the student survey"}
                  <SlidersHorizontal size={15} />
                </button>
              </section>
            )}
            {error ? (
              <div className="empty-state" role="alert">
                <Info size={32} />
                <h2>We couldn’t load the catalog.</h2>
                <p>{error}</p>
                <button
                  className="button primary"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  Try again
                </button>
              </div>
            ) : loading ? (
              <div className="loading-state" role="status">
                <span className="spinner" />
                Finding the possibilities…
              </div>
            ) : page === "tracker" ? (
              <section className="tracker-layout">
                <aside className="tracker-sidebar">
                  <h2>Your price trackers</h2>
                  <p className="fine-print">
                    Targets are stored on this device.
                  </p>
                  {enriched.map((l) => (
                    <button
                      className={`tracker-choice ${selectedTracker?.laptop_id === l.laptop_id ? "active" : ""}`}
                      key={l.laptop_id}
                      onClick={() => setTrackerId(l.laptop_id)}
                    >
                      <span>
                        {l.laptop_id}
                        <small>
                          {targets[l.laptop_id]
                            ? `Target ${money(targets[l.laptop_id])}`
                            : "No target set"}
                        </small>
                      </span>
                      <strong>{money(l.latest_recorded_price_usd)}</strong>
                    </button>
                  ))}
                </aside>
                {selectedTracker && (
                  <div className="tracker-content">
                    <div className="tracker-product">
                      <div className="tracker-art">
                        <LaptopArt laptop={selectedTracker} />
                      </div>
                      <div>
                        <p className="eyebrow">{selectedTracker.brand}</p>
                        <h2>{selectedTracker.laptop_id}</h2>
                        <p>
                          {selectedTracker.specifications.cpu} ·{" "}
                          {selectedTracker.specifications.ram_gb} GB RAM
                        </p>
                        <strong className="price">
                          {money(selectedTracker.latest_recorded_price_usd)}
                        </strong>
                        <p className="fine-print">
                          Latest recorded ·{" "}
                          {dateLabel(selectedTracker.price_record_date)}
                        </p>
                        <button
                          className="button primary"
                          onClick={() => openTarget(selectedTracker)}
                        >
                          <Bell size={16} />
                          {targets[selectedTracker.laptop_id]
                            ? "Edit price target"
                            : "Set price target"}
                        </button>
                      </div>
                    </div>
                    {targets[selectedTracker.laptop_id] && (
                      <div className="target-status">
                        <div>
                          <strong>
                            {selectedTracker.latest_recorded_price_usd !=
                              null &&
                            selectedTracker.latest_recorded_price_usd <=
                              targets[selectedTracker.laptop_id]
                              ? "Recorded price meets your target"
                              : "Your target is saved"}{" "}
                            · {money(targets[selectedTracker.laptop_id])}
                          </strong>
                          <p>
                            This compares your target with the latest CSV
                            observation. No background monitoring or email
                            alerts.
                          </p>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Remove price target"
                          onClick={() => {
                            setTargets((old) => {
                              const next = { ...old };
                              delete next[selectedTracker.laptop_id];
                              return next;
                            });
                            setNotice("Price target removed.");
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                    <PriceChart id={selectedTracker.laptop_id} large />
                    {selectedTracker.price_history && (
                      <div className="price-stats">
                        {[
                          [
                            "Recorded low",
                            selectedTracker.price_history.historical_low_usd,
                          ],
                          [
                            "Historical median",
                            selectedTracker.price_history.historical_median_usd,
                          ],
                          [
                            "Recorded high",
                            selectedTracker.price_history.historical_high_usd,
                          ],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong>{money(Number(value))}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <>
                <div className="catalog-layout">
                  <aside
                    className={`filters ${filterOpen ? "mobile-open" : ""}`}
                  >
                    <div className="filters-heading">
                      <button
                        className="icon-button close-filters"
                        aria-label="Close filters"
                        onClick={() => setFilterOpen(false)}
                      >
                        <X size={18} />
                      </button>
                      <h2>
                        Filters{" "}
                        {activeFilters > 0 && <small>({activeFilters})</small>}
                      </h2>
                      <button
                        className="text-button"
                        onClick={() => setFilters(initialFilters)}
                      >
                        Reset all
                      </button>
                    </div>
                    <fieldset>
                      <legend>Maximum recorded price</legend>
                      <div className="range-labels">
                        <span>$0</span>
                        <strong>
                          {filters.max === 5000
                            ? "$5,000+"
                            : money(filters.max)}
                        </strong>
                      </div>
                      <input
                        aria-label="Maximum recorded price"
                        type="range"
                        min="0"
                        max="5000"
                        step="50"
                        value={filters.max}
                        onChange={(e) =>
                          setFilters((old) => ({
                            ...old,
                            max: Number(e.target.value),
                          }))
                        }
                      />
                      <span className="fine-print">
                        USD · latest observation
                      </span>
                    </fieldset>
                    <fieldset>
                      <legend>Brand</legend>
                      {Array.from(new Set(catalog.map((l) => l.brand)))
                        .sort()
                        .map((brand) => (
                          <label className="filter-option" key={brand}>
                            <input
                              type="checkbox"
                              checked={filters.brands.includes(brand)}
                              onChange={() => filterArray("brands", brand)}
                            />
                            {brand}
                            <span>
                              {catalog.filter((l) => l.brand === brand).length}
                            </span>
                          </label>
                        ))}
                    </fieldset>
                    <fieldset>
                      <legend>Memory</legend>
                      {Array.from(
                        new Set(catalog.map((l) => l.specifications.ram_gb)),
                      )
                        .sort((a, b) => a - b)
                        .map((ram) => (
                          <label className="filter-option" key={ram}>
                            <input
                              type="checkbox"
                              checked={filters.ram.includes(ram)}
                              onChange={() => filterArray("ram", ram)}
                            />
                            {ram} GB
                          </label>
                        ))}
                    </fieldset>
                    <fieldset>
                      <legend>Screen size</legend>
                      {[
                        ["all", "Any screen size"],
                        ["compact", "13–14 inches"],
                        ["large", "15–16 inches"],
                      ].map(([v, label]) => (
                        <label className="filter-option" key={v}>
                          <input
                            type="radio"
                            name="screen-filter"
                            checked={filters.screen === v}
                            onChange={() =>
                              setFilters((old) => ({ ...old, screen: v }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </fieldset>
                    <label className="deal-toggle">
                      <span>Below median price</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={filters.deals}
                        onChange={(e) =>
                          setFilters((old) => ({
                            ...old,
                            deals: e.target.checked,
                          }))
                        }
                      />
                    </label>
                    <p className="fine-print">Find a little more value.</p>
                  </aside>
                  <section className="results" aria-label="Laptop results">
                    <label className="mobile-search">
                      <Search size={17} />
                      <input
                        aria-label="Search this laptop list"
                        placeholder="Search laptops, brands, or specs"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <div className="results-heading">
                      <div>
                        <h2>
                          {page === "saved"
                            ? "Your saved laptops"
                            : result
                              ? "Your best matches"
                              : "Meet your next laptop"}
                        </h2>
                        <p>
                          {visible.length}{" "}
                          {visible.length === 1 ? "laptop" : "laptops"}
                          {result && page !== "saved"
                            ? " · ranked around you"
                            : " · from the local catalog"}
                        </p>
                      </div>
                      <div className="sort-controls">
                        <button
                          className="button outline mobile-filter"
                          onClick={() => setFilterOpen((v) => !v)}
                          aria-expanded={filterOpen}
                        >
                          <SlidersHorizontal size={16} />
                          Filters
                        </button>
                        <label className="sort-label">
                          <span>Sort by:</span>
                          <select
                            aria-label="Sort laptops"
                            value={sort}
                            onChange={(e) => {
                              setSort(e.target.value);
                              if (category === "value") setCategory("all");
                            }}
                          >
                            <option value="match">
                              {result ? "Best match" : "Name"}
                            </option>
                            <option value="price">Price: low to high</option>
                            <option value="price-desc">
                              Price: high to low
                            </option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="results-toolbar">
                      <div className="pills">
                        {[
                          ["all", "All matches"],
                          ["value", "Lowest price"],
                          ["deals", "Below median"],
                        ].map(([v, label]) => (
                          <button
                            key={v}
                            className={category === v ? "active" : ""}
                            aria-pressed={category === v}
                            onClick={() => {
                              setCategory(v);
                              if (v === "value") setSort("price");
                              else if (category === "value") setSort("match");
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <span className="fine-print">Recorded prices · USD</span>
                    </div>
                    {result && page === "discover" && (
                      <button
                        className="text-button browse-catalog"
                        onClick={() => {
                          setPreferences(null);
                          setResult(null);
                          setFilters(initialFilters);
                          setSearch("");
                          setCategory("all");
                        }}
                      >
                        Clear preferences and browse all laptops
                      </button>
                    )}
                    {result?.status === "partial" && page === "discover" && (
                      <p className="info-banner">
                        <Info size={17} />
                        Some prices are missing. Budget fit could not be
                        verified for those laptops.
                      </p>
                    )}
                    {!visible.length ? (
                      <div className="empty-state">
                        <LaptopIcon size={38} />
                        <h2>
                          {page === "saved" && !saved.length
                            ? "Your shortlist starts here."
                            : page === "discover" &&
                                result?.status === "no_matches"
                              ? "No laptops fit these preferences yet."
                              : "No laptops match these filters."}
                        </h2>
                        <p>
                          {page === "saved" && !saved.length
                            ? "Tap the heart on a laptop to keep it here."
                            : page === "discover" &&
                                result?.status === "no_matches"
                              ? "Try a higher budget or another operating system. We won’t quietly change your preferences."
                              : "Try clearing your search or widening the filters."}
                        </p>
                        <button
                          className="button primary"
                          onClick={() => {
                            setFilters(initialFilters);
                            setSearch("");
                            setCategory("all");
                            if (page === "saved" && !saved.length)
                              navigate("discover");
                            else if (
                              page === "discover" &&
                              result?.status === "no_matches"
                            )
                              navigate("survey");
                          }}
                        >
                          {page === "saved" && !saved.length
                            ? "Discover laptops"
                            : page === "discover" &&
                                result?.status === "no_matches"
                              ? "Adjust preferences"
                              : "Clear filters"}
                        </button>
                        {result && (
                          <button
                            className="text-button"
                            onClick={() => {
                              setPreferences(null);
                              setResult(null);
                            }}
                          >
                            Browse all laptops
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="laptop-grid">
                        {visible.map((l, index) => (
                          <article
                            className={`laptop-card ${index === 0 ? "first-card" : ""}`}
                            key={l.laptop_id}
                          >
                            <div
                              className={`product-visual tone-${l.brand?.toLowerCase()}`}
                            >
                              <span
                                className={`product-badge ${index === 0 ? "featured" : ""}`}
                              >
                                {l.rank === 1
                                  ? "Best match"
                                  : l.price_history &&
                                      l.latest_recorded_price_usd != null &&
                                      l.latest_recorded_price_usd <
                                        l.price_history.historical_median_usd
                                    ? "Below median"
                                    : l.specifications.screen_size_in <= 14.5
                                      ? "Compact pick"
                                      : "Room to create"}
                              </span>
                              <button
                                className={`heart-button ${saved.includes(l.laptop_id) ? "is-saved" : ""}`}
                                aria-label={`${saved.includes(l.laptop_id) ? "Unsave" : "Save"} ${l.laptop_id}`}
                                aria-pressed={saved.includes(l.laptop_id)}
                                onClick={() => toggleSave(l.laptop_id)}
                              >
                                <Heart
                                  size={18}
                                  fill={
                                    saved.includes(l.laptop_id)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                              <button
                                className="art-button"
                                onClick={() => setDetail(l)}
                                aria-label={`View ${l.laptop_id}`}
                              >
                                <LaptopArt laptop={l} />
                              </button>
                            </div>
                            <div className="card-body">
                              <div className="brand-row">
                                <span>{l.brand}</span>
                                {l.match_score != null && (
                                  <span className="match-badge">
                                    {l.match_score}% match
                                  </span>
                                )}
                              </div>
                              <h3>
                                <button onClick={() => setDetail(l)}>
                                  {l.laptop_id}
                                </button>
                              </h3>
                              <p className="spec-line">
                                {l.specifications.cpu} ·{" "}
                                {l.specifications.ram_gb} GB RAM
                                {l.specifications.ram_estimated ? "*" : ""}
                              </p>
                              <p className="spec-line">
                                {l.specifications.screen_size_in}″ screen ·{" "}
                                {storage(l.specifications.storage_gb)} storage
                              </p>
                              <p className="card-reason">
                                {l.reasons.find((r) => !r.includes("budget")) ||
                                  `${l.specifications.os}. Ready for your next chapter.`}
                              </p>
                              <div className="card-price">
                                <strong>
                                  {money(l.latest_recorded_price_usd)}
                                </strong>
                                {l.price_history &&
                                  l.latest_recorded_price_usd != null &&
                                  l.price_history.historical_median_usd >
                                    l.latest_recorded_price_usd && (
                                    <del title="Historical median">
                                      {money(
                                        l.price_history.historical_median_usd,
                                      )}
                                    </del>
                                  )}
                              </div>
                              <p className="price-date">
                                Recorded {dateLabel(l.price_record_date)}
                                {l.specifications.ram_estimated
                                  ? " · *RAM estimated"
                                  : ""}
                              </p>
                              <button
                                className={`button ${index === 0 ? "primary" : "soft"} view-button`}
                                onClick={() => setDetail(l)}
                              >
                                View laptop
                              </button>
                              <label className="compare-check">
                                <input
                                  type="checkbox"
                                  checked={compare.includes(l.laptop_id)}
                                  onChange={() => toggleCompare(l.laptop_id)}
                                />
                                Compare laptop
                              </label>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                    {top && (
                      <section className="price-feature">
                        <PriceChart id={top.laptop_id} />
                        <DealSummary
                          laptop={top}
                          onTrack={() => openTarget(top)}
                        />
                      </section>
                    )}
                    {result && page === "discover" && (
                      <div className="data-note">
                        <Info size={17} />
                        <div>
                          <p>{result.metadata.price_basis}</p>
                          {result.warnings.length > 0 && (
                            <details>
                              <summary>
                                {result.warnings.length} data notes to keep in
                                mind
                              </summary>
                              <ul>
                                {result.warnings.map((w) => (
                                  <li key={w}>{w}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <footer className="footer">
        <strong>
          lapwise<span>.</span>
        </strong>
        <span>A smarter way to find your next laptop.</span>
        <span className="footer-note">
          Local catalog · Recorded prices · No account needed
        </span>
        <button className="text-button" onClick={() => setHow(true)}>
          About & privacy
        </button>
        <a href="/docs" target="_blank" rel="noreferrer">
          API docs
        </a>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {compare.length > 0 && !comparison && (
        <div className="compare-bar">
          <BarChart3 size={20} />
          <span>{compare.length} of 3 laptops selected</span>
          <button
            className="button primary"
            disabled={compare.length < 2}
            onClick={() => setComparison(true)}
          >
            Compare laptops
          </button>
          <button
            className="icon-button"
            aria-label="Clear comparison"
            onClick={() => setCompare([])}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {detail && (
        <Modal title={detail.laptop_id} onClose={() => setDetail(null)} wide>
          <div className="detail-grid">
            <div className="detail-art">
              <LaptopArt laptop={detail} />
              <span className="fine-print">
                Illustration · Refer to retailer for product images
              </span>
            </div>
            <div>
              <span className="eyebrow">
                {detail.brand}{" "}
                {detail.match_score != null
                  ? `· ${detail.match_score}% MATCH`
                  : ""}
              </span>
              <p className="detail-price">
                {money(detail.latest_recorded_price_usd)}
              </p>
              <p className="fine-print">
                Latest recorded on {dateLabel(detail.price_record_date)}. Check
                the retailer for the current price.
              </p>
              <div className="spec-grid">
                <div>
                  <Cpu size={18} />
                  <span>
                    Processor<strong>{detail.specifications.cpu}</strong>
                  </span>
                </div>
                <div>
                  <Monitor size={18} />
                  <span>
                    Display
                    <strong>
                      {detail.specifications.screen_size_in} inches
                    </strong>
                  </span>
                </div>
                <div>
                  <HardDrive size={18} />
                  <span>
                    Storage
                    <strong>{storage(detail.specifications.storage_gb)}</strong>
                  </span>
                </div>
                <div>
                  <LaptopIcon size={18} />
                  <span>
                    Memory
                    <strong>
                      {detail.specifications.ram_gb} GB
                      {detail.specifications.ram_estimated
                        ? " (estimated)"
                        : ""}
                    </strong>
                  </span>
                </div>
              </div>
              <p>{detail.specifications.os}</p>
              <div className="detail-actions">
                {detail.amazon_url &&
                  /^https:\/\/www\.amazon\.com\//.test(detail.amazon_url) && (
                    <a
                      className="button primary"
                      href={detail.amazon_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on Amazon <ExternalLink size={15} />
                    </a>
                  )}
                <button
                  className="button outline"
                  onClick={() => toggleSave(detail.laptop_id)}
                >
                  <Heart size={16} />
                  {saved.includes(detail.laptop_id) ? "Saved" : "Save laptop"}
                </button>
              </div>
            </div>
          </div>
          <Reasons laptop={detail} />
          <PriceChart id={detail.laptop_id} large />
          <button
            className="button soft"
            onClick={() => {
              setTrackerId(detail.laptop_id);
              setDetail(null);
              navigate("tracker");
            }}
          >
            Open price tracker
          </button>
        </Modal>
      )}
      {comparison && (
        <Modal
          title="A closer look, side by side."
          onClose={() => setComparison(false)}
          wide
        >
          <div className="comparison-scroll">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Compare</th>
                  {compare.map((id) => (
                    <th key={id}>
                      {id}
                      <button
                        className="icon-button"
                        aria-label={`Remove ${id} from comparison`}
                        onClick={() => {
                          setCompare((old) => old.filter((v) => v !== id));
                          if (compare.length <= 2) setComparison(false);
                        }}
                      >
                        <X size={16} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Recorded price",
                    (l: Laptop) => money(l.latest_recorded_price_usd),
                  ],
                  [
                    "Recorded date",
                    (l: Laptop) => dateLabel(l.price_record_date),
                  ],
                  [
                    "Match score",
                    (l: Laptop) =>
                      l.match_score != null
                        ? `${l.match_score}%`
                        : "Take survey",
                  ],
                  ["Processor", (l: Laptop) => l.specifications.cpu],
                  [
                    "Memory",
                    (l: Laptop) =>
                      `${l.specifications.ram_gb} GB${l.specifications.ram_estimated ? " (estimated)" : ""}`,
                  ],
                  [
                    "Storage",
                    (l: Laptop) => storage(l.specifications.storage_gb),
                  ],
                  [
                    "Display",
                    (l: Laptop) => `${l.specifications.screen_size_in} inches`,
                  ],
                  ["Operating system", (l: Laptop) => l.specifications.os],
                  [
                    "Historical low",
                    (l: Laptop) => money(l.price_history?.historical_low_usd),
                  ],
                ].map(([label, format]) => (
                  <tr key={String(label)}>
                    <th>{String(label)}</th>
                    {compare.map((id) => (
                      <td key={id}>
                        {enriched.find((l) => l.laptop_id === id)
                          ? (format as (l: Laptop) => string)(
                              enriched.find((l) => l.laptop_id === id)!,
                            )
                          : "Unavailable"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {targetLaptop && (
        <Modal
          title="A price that works for you."
          onClose={() => setTargetLaptop(null)}
        >
          <p>
            Set a local target for <strong>{targetLaptop.laptop_id}</strong>.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(targetValue);
              if (!Number.isFinite(amount) || amount <= 0) return;
              setTargets((old) => ({
                ...old,
                [targetLaptop.laptop_id]: amount,
              }));
              setTrackerId(targetLaptop.laptop_id);
              setTargetLaptop(null);
              setNotice("Price target saved in this browser.");
              navigate("tracker");
            }}
          >
            <label className="target-input">
              Your target price (USD)
              <input
                autoFocus
                required
                type="number"
                step="0.01"
                min="0.01"
                max="100000"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
              />
            </label>
            <p className="info-banner">
              <Info size={18} />
              This MVP compares against recorded CSV prices. It does not fetch
              live prices, send emails, or monitor prices in the background.
            </p>
            <button className="button primary" type="submit">
              Save price target
            </button>
          </form>
        </Modal>
      )}
      {how && (
        <Modal title="A little less guesswork." onClose={() => setHow(false)}>
          <div className="how-content">
            <p>
              Lapwise helps students find a laptop that fits their coursework
              and budget.
            </p>
            <h3>Tell us what matters</h3>
            <p>
              Choose your field, software needs, and everyday preferences in a
              short survey.
            </p>
            <h3>Understand your matches</h3>
            <p>
              The API filters by operating system, Chromebook eligibility, and
              budget, then scores memory, storage, screen size, portability,
              software compatibility, and historical value. The top three
              matches include reasons and tradeoffs.
            </p>
            <h3>Keep prices in perspective</h3>
            <p>
              All prices come from the provided CSV observations, not live
              retailer listings. The catalog has {catalog.length} laptops.
              Product drawings are illustrations. Confirm current specifications
              and prices with the retailer.
            </p>
            <h3>Your browser. Your shortlist.</h3>
            <p>
              Preferences, saved laptops, and price targets are stored in this
              browser’s local storage. Survey answers are sent only to your
              local API. No account, telemetry, or email notifications are
              included.
            </p>
            <button
              className="button primary"
              onClick={() => {
                setHow(false);
                navigate("survey");
              }}
            >
              Find my laptop
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
