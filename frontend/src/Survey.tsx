import { useEffect, useState } from "react";
import {
  BookOpen,
  Code2,
  Palette,
  Ruler,
  Check,
  Laptop,
  BriefcaseBusiness,
} from "lucide-react";
import type { Survey as SurveyType } from "./types";
import { api } from "./api";
import { money } from "./components";

export const defaultSurvey: SurveyType = {
  major: "",
  budget_usd: 1500,
  operating_system: "no_preference",
  usage: ["schoolwork"],
  screen_size_preference: "no_preference",
  portability: "medium",
  storage_preference_gb: 512,
  allow_chromebooks: false,
};
const groups = [
  {
    name: "Computing and data",
    example: "Computer science, statistics, information systems",
    icon: Code2,
    profiles: [
      {
        name: "VS Code / Python / R",
        description:
          "Build, debug, analyze. For everyday development and coursework.",
        usage: ["programming", "schoolwork"],
      },
      {
        name: "Virtual machines / large data",
        description:
          "For data analysis and development with demanding workloads.",
        usage: ["programming", "data_science"],
      },
    ],
  },
  {
    name: "Engineering and architecture",
    example: "Engineering, architecture, applied sciences",
    icon: Ruler,
    profiles: [
      {
        name: "CAD / engineering software",
        description:
          "Technical coursework with desktop engineering applications.",
        usage: ["engineering_software", "schoolwork"],
      },
      {
        name: "Simulation / data analysis",
        description:
          "Engineering projects, scientific computing, and analysis.",
        usage: ["engineering_software", "data_science"],
      },
    ],
  },
  {
    name: "Design and media",
    example: "Graphic design, film, photography, digital arts",
    icon: Palette,
    profiles: [
      {
        name: "Design / photo editing",
        description:
          "Visual projects, creative software, and everyday coursework.",
        usage: ["creative_work", "schoolwork"],
      },
      {
        name: "Video / creative production",
        description:
          "Multitasking across creative applications and larger projects.",
        usage: ["creative_work", "web_browsing"],
      },
    ],
  },
  {
    name: "Business and humanities",
    example: "Business, writing, social sciences, general studies",
    icon: BriefcaseBusiness,
    profiles: [
      {
        name: "Documents / research / presentations",
        description:
          "Notes, research, spreadsheets, and everyday productivity.",
        usage: ["schoolwork", "web_browsing"],
      },
      {
        name: "Analytics / spreadsheets / coding",
        description:
          "Add data analysis and programming to your everyday coursework.",
        usage: ["schoolwork", "data_science"],
      },
    ],
  },
];
const labels: Record<string, string> = {
  no_preference: "No preference",
  Windows: "Windows",
  macOS: "macOS",
  ChromeOS: "ChromeOS",
  "13-14": "Compact · 13–14 inches",
  "15-16": "Roomier · 15–16 inches",
  low: "Mostly at my desk",
  medium: "A little of both",
  high: "On the go every day",
  programming: "Programming",
  schoolwork: "Schoolwork",
  engineering_software: "Engineering software",
  data_science: "Data science",
  creative_work: "Creative work",
  web_browsing: "Web browsing",
};
export default function Survey({
  initial,
  onSubmit,
  busy,
  error,
  onCancel,
}: {
  initial: SurveyType | null;
  onSubmit: (v: SurveyType) => void;
  busy: boolean;
  error: string;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(initial ? 2 : 0),
    [value, setValue] = useState<SurveyType>(initial || defaultSurvey),
    [options, setOptions] = useState<Record<string, string[]> | null>(null),
    [optionError, setOptionError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setOptionError("");
    api
      .options()
      .then((r) => {
        if (active) setOptions(r);
      })
      .catch(() => {
        if (active)
          setOptionError(
            "We couldn’t load survey options. Check the API and retry.",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const group = groups.find((g) => g.name === value.major) || groups[0];
  function update<K extends keyof SurveyType>(key: K, v: SurveyType[K]) {
    setValue((old) => ({ ...old, [key]: v }));
  }
  return (
    <section className="survey-shell">
      <div className="survey-top">
        <button
          className="text-button"
          onClick={() => (step ? setStep(step - 1) : onCancel())}
          disabled={busy}
        >
          {step ? "Back" : "Back to discover"}
        </button>
        <span className="eyebrow">FOR YOUR NEXT CHAPTER</span>
      </div>
      <div className="stepper">
        {["Your major", "Your software", "Your preferences"].map((title, i) => (
          <div key={title} className={step >= i ? "complete" : ""}>
            <span>{step > i ? <Check size={14} /> : i + 1}</span>
            {title}
          </div>
        ))}
      </div>
      <p className="eyebrow">STUDENT LAPTOP MATCH / {step + 1} OF 3</p>
      <h1>
        {
          [
            "A smarter match starts with you.",
            "What will you use your laptop for?",
            "Make it fit your everyday.",
          ][step]
        }
      </h1>
      <p className="intro">
        {
          [
            "Choose the field closest to your studies. We’ll help narrow things down.",
            `${group.name} · Choose a software profile closest to your coursework.`,
            "A few practical preferences. Your budget is a firm limit; other needs help rank your matches.",
          ][step]
        }
      </p>
      {step === 0 && (
        <div className="major-grid">
          {groups.map((g) => (
            <button
              className="major-card"
              key={g.name}
              onClick={() => {
                update("major", g.name);
                setStep(1);
              }}
            >
              <span className="major-icon">
                <g.icon size={25} />
              </span>
              <h2>{g.name}</h2>
              <p>{g.example}</p>
              <span className="choose-label">
                Choose this field <span>+</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {step === 1 && (
        <>
          <div className="profile-grid">
            {group.profiles.map((profile, i) => (
              <article
                className={`profile-card ${i ? "tinted" : ""}`}
                key={profile.name}
              >
                <span className="eyebrow">
                  {i ? "SPECIALIST WORKLOAD" : "EVERYDAY COURSEWORK"}
                </span>
                <h2>{profile.name}</h2>
                <p>{profile.description}</p>
                <span className="profile-note">
                  {i
                    ? "Prioritizes workload compatibility."
                    : "Balances your coursework and everyday needs."}
                </span>
                <button
                  className="button primary"
                  onClick={() => {
                    update("usage", profile.usage);
                    setStep(2);
                  }}
                >
                  Use this software profile
                </button>
              </article>
            ))}
          </div>
          <p className="fine-print">
            Recommendations are starting points, not a software certification.
            Check your course’s requirements.
          </p>
        </>
      )}
      {step === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(value);
          }}
          className="preferences-form"
        >
          <div className="preferences-fields">
            <label>
              Your field of study
              <input
                required
                value={value.major}
                onChange={(e) => update("major", e.target.value)}
                placeholder="e.g. Computer science"
                maxLength={120}
              />
            </label>
            <div className="budget-field">
              <label htmlFor="budget">
                Maximum budget <span>USD</span>
              </label>
              <div className="budget-input">
                <span>$</span>
                <input
                  id="budget"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  value={value.budget_usd || ""}
                  onChange={(e) => update("budget_usd", Number(e.target.value))}
                />
              </div>
              <input
                aria-label="Adjust maximum budget"
                type="range"
                min="200"
                max="3500"
                step="50"
                value={Math.max(200, Math.min(3500, value.budget_usd))}
                onChange={(e) => update("budget_usd", Number(e.target.value))}
              />
              <div className="range-labels">
                <span>$200</span>
                <span>$3,500+</span>
              </div>
            </div>
            {optionError ? (
              <div role="alert" className="error-banner">
                {optionError}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  Retry
                </button>
              </div>
            ) : !options ? (
              <p role="status">Loading preferences…</p>
            ) : (
              <>
                <label>
                  Operating system
                  <select
                    value={value.operating_system}
                    onChange={(e) =>
                      setValue((old) => ({
                        ...old,
                        operating_system: e.target.value,
                        allow_chromebooks:
                          e.target.value === "ChromeOS" ||
                          old.allow_chromebooks,
                      }))
                    }
                  >
                    {options.operating_system.map((v) => (
                      <option key={v} value={v}>
                        {labels[v] || v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Screen size
                  <select
                    value={value.screen_size_preference}
                    onChange={(e) =>
                      update("screen_size_preference", e.target.value)
                    }
                  >
                    {options.screen_size_preference.map((v) => (
                      <option key={v} value={v}>
                        {labels[v] || v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Where will you use it?
                  <select
                    value={value.portability}
                    onChange={(e) => update("portability", e.target.value)}
                  >
                    {options.portability.map((v) => (
                      <option key={v} value={v}>
                        {labels[v] || v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Storage space
                  <select
                    value={value.storage_preference_gb}
                    onChange={(e) =>
                      update("storage_preference_gb", Number(e.target.value))
                    }
                  >
                    {[128, 256, 512, 1024, 2048].map((v) => (
                      <option key={v} value={v}>
                        {v >= 1024 ? `${v / 1024} TB` : `${v} GB`}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="usage-field">
                  <legend>
                    What you’ll use it for <span>Choose at least one</span>
                  </legend>
                  <div className="usage-options">
                    {options.usage.map((use) => (
                      <label key={use}>
                        <input
                          type="checkbox"
                          checked={value.usage.includes(use)}
                          onChange={(e) =>
                            update(
                              "usage",
                              e.target.checked
                                ? [...value.usage, use]
                                : value.usage.filter((v) => v !== use),
                            )
                          }
                        />
                        {labels[use] || use}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="checkbox-label full-width">
                  <input
                    type="checkbox"
                    checked={value.allow_chromebooks}
                    disabled={value.operating_system === "ChromeOS"}
                    onChange={(e) =>
                      update("allow_chromebooks", e.target.checked)
                    }
                  />
                  Include Chromebooks{" "}
                  {value.operating_system === "ChromeOS"
                    ? "(required for ChromeOS)"
                    : ""}
                </label>
              </>
            )}
          </div>
          <aside className="survey-summary">
            <div className="major-icon">
              <Laptop size={28} />
            </div>
            <h2>
              Your next chapter,
              <br />
              your next laptop.
            </h2>
            <p>
              We’ll compare your needs with our local catalog, then explain the
              strengths and tradeoffs of your top matches.
            </p>
            <div>
              <span>Your budget</span>
              <strong>{money(value.budget_usd)}</strong>
            </div>
            <div>
              <span>Your field</span>
              <strong>{value.major || "Not selected"}</strong>
            </div>
            <p className="fine-print">
              <BookOpen size={16} /> No account needed. Your preferences stay in
              this browser.
            </p>
          </aside>
          <div className="form-footer">
            {error && (
              <p className="error-banner" role="alert">
                {error}
              </p>
            )}
            {!value.usage.length && (
              <p className="error-banner" role="alert">
                Choose at least one use for your laptop.
              </p>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={
                busy || !options || !value.usage.length || !value.major.trim()
              }
            >
              {busy ? "Finding your matches…" : "Find my laptop matches"}
            </button>
            <span className="fine-print">
              Based on recorded prices, not live retailer data.
            </span>
          </div>
        </form>
      )}
    </section>
  );
}
