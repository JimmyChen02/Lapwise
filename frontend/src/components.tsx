import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, TrendingDown, Bell, Check } from "lucide-react";
import { api } from "./api";
import type { Laptop, Point } from "./types";

export const money = (value: number | null | undefined) =>
  value == null
    ? "Price unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: value % 1 ? 2 : 0,
      }).format(value);
export const dateLabel = (value: string | null) =>
  value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No recorded date";
export const storage = (gb: number) =>
  gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
export function useStored<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) || "null");
      return validate(data) ? data : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Storage can be disabled; the current session still works. */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export function LaptopArt({ laptop }: { laptop: Laptop }) {
  const id = useId();
  const palette =
    laptop.brand === "Apple"
      ? ["#b3c8d6", "#658b9e", "#dae5ea"]
      : laptop.brand === "Acer"
        ? ["#b5c9b4", "#5d8467", "#dce5c9"]
        : laptop.brand === "Lenovo"
          ? ["#dfb896", "#aa795b", "#f4ddc5"]
          : ["#a6abda", "#6465a0", "#d7daef"];
  return (
    <svg
      className="laptop-art"
      viewBox="0 0 360 220"
      role="img"
      aria-label={`Illustration of ${laptop.laptop_id}; not a product photograph`}
    >
      <defs>
        <linearGradient id={`${id}-screen`} x1="0" y1="1" x2="1" y2="0">
          <stop stopColor={palette[1]} />
          <stop offset="1" stopColor={palette[0]} />
        </linearGradient>
        <linearGradient id={`${id}-body`}>
          <stop stopColor="#c5c9c7" />
          <stop offset=".5" stopColor="#edf0ec" />
          <stop offset="1" stopColor="#939e99" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d="M85 37H276V158H85z" />
        </clipPath>
      </defs>
      <ellipse cx="180" cy="196" rx="131" ry="9" fill="#243b32" opacity=".1" />
      <g transform="rotate(-5 180 120)">
        <rect x="78" y="29" width="205" height="139" rx="8" fill="#66736d" />
        <rect x="81" y="32" width="199" height="132" rx="5" fill="#25302b" />
        <path d="M85 37H276V158H85z" fill={`url(#${id}-screen)`} />
        <g clipPath={`url(#${id}-clip)`} fill="none" stroke={palette[2]}>
          <ellipse
            cx="265"
            cy="65"
            rx="87"
            ry="126"
            strokeWidth="24"
            opacity=".6"
            transform="rotate(40 265 65)"
          />
          <ellipse
            cx="133"
            cy="154"
            rx="64"
            ry="98"
            strokeWidth="18"
            opacity=".45"
            transform="rotate(40 133 154)"
          />
          <path d="M75 161Q130 20 291 47" strokeWidth="6" opacity=".5" />
        </g>
        <circle cx="180" cy="34" r="1.3" fill="#bcc5be" />
        <path
          d="M78 168H283L318 190Q320 195 312 197H45Q38 195 43 190Z"
          fill={`url(#${id}-body)`}
        />
        <path d="M87 171H274L290 183H69Z" fill="#64716b" opacity=".6" />
        <path d="M144 184H215L222 191H138Z" fill="#a4afa8" />
        <path d="M45 196H312" stroke="#7e8b82" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const active = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = "";
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function PriceChart({
  id,
  large = false,
}: {
  id: string;
  large?: boolean;
}) {
  const [points, setPoints] = useState<Point[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [range, setRange] = useState(90),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .history(id)
      .then((r) => {
        if (active) setPoints(r.observations);
      })
      .catch(() => {
        if (active) setError("Price history couldn’t load.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);
  const [hovered, setHovered] = useState<number | null>(null);
  const chartHint = useId();
  useEffect(() => setHovered(null), [id, range]);
  const latest = points.at(-1);
  const cutoff = latest ? Date.parse(latest.date) - range * 86400000 : 0;
  const visible = points.filter(
    (p) => range === 0 || Date.parse(p.date) >= cutoff,
  );
  const values = visible.map((p) => p.price_usd),
    min = Math.min(...values),
    max = Math.max(...values),
    padding = Math.max((max - min) * 0.2, 20),
    bottom = min - padding,
    top = max + padding;
  const first = Date.parse(visible[0]?.date || ""),
    last = Date.parse(visible.at(-1)?.date || "");
  const coords = visible.map((p) => [
    64 + ((Date.parse(p.date) - first) / Math.max(last - first, 1)) * 646,
    20 + ((top - p.price_usd) / Math.max(top - bottom, 1)) * 160,
  ]);
  const path = coords
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  return (
    <div className={`price-chart ${large ? "large" : ""}`}>
      <div className="chart-head">
        <div>
          <h3>Recorded price history</h3>
          <p>{id} · USD</p>
        </div>
        <div className="segmented" aria-label="Price history period">
          {[30, 90, 0].map((days) => (
            <button
              key={days}
              className={range === days ? "active" : ""}
              aria-pressed={range === days}
              onClick={() => setRange(days)}
            >
              {days ? `${days}D` : "All"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="chart-placeholder" role="status">
          Loading recorded prices…
        </div>
      ) : error ? (
        <div className="chart-placeholder" role="alert">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry
          </button>
        </div>
      ) : !visible.length ? (
        <div className="chart-placeholder">
          No price observations available.
        </div>
      ) : (
        <>
          <div className="chart-plot">
          <svg
            tabIndex={0}
            aria-describedby={chartHint}
            onPointerMove={(event) => {
              const matrix = event.currentTarget.getScreenCTM();
              if (!matrix) return;
              const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
              if (position.x < 64 || position.x > 710 || position.y < 20 || position.y > 180) { setHovered(null); return; }
              const nearest = coords.reduce((best, point, index) => Math.abs(point[0] - position.x) < Math.abs(coords[best][0] - position.x) ? index : best, 0);
              setHovered(nearest);
            }}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(visible.length - 1)}
            onBlur={() => setHovered(null)}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(event.key)) return;
              event.preventDefault();
              if (event.key === "Escape") setHovered(null);
              else if (event.key === "Home") setHovered(0);
              else if (event.key === "End") setHovered(visible.length - 1);
              else setHovered(old => Math.max(0, Math.min(visible.length - 1, (old ?? visible.length - 1) + (event.key === "ArrowLeft" ? -1 : 1))));
            }}
            viewBox="0 0 740 220"
            role="img"
            aria-label={`${id} recorded prices from ${dateLabel(visible[0].date)} to ${dateLabel(visible.at(-1)!.date)}, ranging from ${money(min)} to ${money(max)}`}
          >
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line
                  x1="64"
                  x2="710"
                  y1={20 + t * 160}
                  y2={20 + t * 160}
                  stroke="#e4e8e0"
                />
                <text x="0" y={25 + t * 160} fill="#727c72" fontSize="12">
                  {money(Math.round(top - (top - bottom) * t))}
                </text>
              </g>
            ))}
            <path
              d={`${path}L${coords.at(-1)![0]},180L${coords[0][0]},180Z`}
              fill="#eaf0df"
            />
            <path
              d={path}
              fill="none"
              stroke="#315a43"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {coords.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3" fill="#315a43">
                <title>
                  {dateLabel(visible[i].date)}: {money(visible[i].price_usd)}
                </title>
              </circle>
            ))}
            {hovered !== null && coords[hovered] && <g pointerEvents="none"><line x1={coords[hovered][0]} x2={coords[hovered][0]} y1="20" y2="180" stroke="#315a43" strokeDasharray="4 4"/><circle cx={coords[hovered][0]} cy={coords[hovered][1]} r="6" fill="#264f3e" stroke="white" strokeWidth="2"/></g>}
            <text x="64" y="210" fontSize="12" fill="#727c72">
              {dateLabel(visible[0].date)}
            </text>
            <text x="710" y="210" textAnchor="end" fontSize="12" fill="#727c72">
              {dateLabel(visible.at(-1)!.date)}
            </text>
          </svg>
          {hovered !== null && visible[hovered] && <div className="chart-tooltip" role="status" style={{left: `${Math.max(22, Math.min(78, coords[hovered][0] / 740 * 100))}%`}}><strong>{money(visible[hovered].price_usd)}</strong><span>{dateLabel(visible[hovered].date)}</span></div>}
          </div>
          <p id={chartHint} className="fine-print">Hover or tap the chart for prices. Use left/right arrow keys when focused.</p>
          <p className="fine-print">
            {visible.length} observations · Period ends at the latest recorded
            date, {dateLabel(latest!.date)}.
          </p>
        </>
      )}
    </div>
  );
}

export function DealSummary({
  laptop,
  onTrack,
}: {
  laptop: Laptop;
  onTrack: () => void;
}) {
  const history = laptop.price_history,
    price = laptop.latest_recorded_price_usd;
  const below =
    history && price != null ? history.historical_median_usd - price : 0;
  return (
    <aside className="deal-summary">
      <span className="eyebrow">
        <TrendingDown size={15} /> A little timing. A better deal.
      </span>
      <h3>
        {below > 0
          ? `${money(below)} below its median.`
          : "Know the price before you buy."}
      </h3>
      <p>
        {history
          ? `Recorded prices range from ${money(history.historical_low_usd)} to ${money(history.historical_high_usd)}. Explore the history to put today’s listing in context.`
          : "Compare new observations as your dataset grows."}
      </p>
      <button className="button white" onClick={onTrack}>
        <Bell size={16} /> Set a price target
      </button>
      <span className="fine-print">
        Local targets · No live monitoring or notifications
      </span>
    </aside>
  );
}

export function Reasons({ laptop }: { laptop: Laptop }) {
  return (
    <div className="reasons">
      <h3>Why it fits</h3>
      {laptop.reasons.length ? (
        laptop.reasons.map((reason) => (
          <p key={reason}>
            <Check size={16} />
            {reason}
          </p>
        ))
      ) : (
        <p>Take the student survey to see personalized reasons.</p>
      )}
      {laptop.tradeoffs.length > 0 && (
        <>
          <h3>Things to consider</h3>
          {laptop.tradeoffs.map((t) => (
            <p key={t} className="tradeoff">
              {t}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
