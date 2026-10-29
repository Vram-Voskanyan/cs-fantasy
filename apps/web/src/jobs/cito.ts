// Minimal Cito CS2 API client (https://citoapi.com). Free plan: 500 calls/month, 10/minute.

const BASE_URL = "https://api.citoapi.com/api/v1";

export type CitoEvent = {
  id: string;
  name: string;
  slug: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  tier: string | null;
  isLan: boolean | null;
  location: string | null;
  prizePool: number | null;
  currency: string | null;
  format: string | null;
  teamCount: number | null;
  logoUrl: string | null;
  bannerImageUrl: string | null;
};

type CitoList<T> = { success: boolean; data: T[]; meta?: Record<string, unknown> };

export class CitoError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Cito ${path} failed with HTTP ${status}`);
  }
}

export async function citoGet<T>(apiKey: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { "x-api-key": apiKey, accept: "application/json" } });
  const remaining = res.headers.get("x-ratelimit-monthly-remaining");
  console.log(`[cito] GET ${path} -> ${res.status} (monthly calls left: ${remaining ?? "?"})`);
  if (!res.ok) throw new CitoError(res.status, path);
  return { body: (await res.json()) as CitoList<T> };
}
