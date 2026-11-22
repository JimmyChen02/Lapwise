import type { Laptop, Point, Result, Survey } from "./types";
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.validation_errors
        ?.map((e: { field: string; error: string }) => `${e.field}: ${e.error}`)
        .join(" ") ||
        error?.detail ||
        "We couldn’t load your laptops. Please try again.",
    );
  }
  return response.json();
}
export const api = {
  catalog: () =>
    request<{ laptops: Laptop[]; price_basis: string }>("/api/v1/laptops"),
  options: () => request<Record<string, string[]>>("/api/v1/options"),
  recommend: (survey: Survey) =>
    request<Result>("/api/v1/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(survey),
    }),
  history: (id: string) =>
    request<{ observations: Point[] }>(
      `/api/v1/laptops/${encodeURIComponent(id)}/prices`,
    ),
};
