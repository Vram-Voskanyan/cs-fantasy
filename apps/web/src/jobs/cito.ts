// Cito CS2 API client and response types (https://citoapi.com). Free plan: 500 calls/month, 10/minute.
// Types list only the fields we use; names match the API.

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

export type CitoTeam = {
  id: string;
  name: string;
  slug: string;
  teamTag: string | null;
  countryName: string | null;
  countryCode: string | null;
  region: string | null;
  worldRanking: number | null;
  vrsRanking: number | null;
  logoUrl: string | null;
};

export type CitoParticipant = {
  teamId: string;
  teamName: string;
  seed: number | null;
  placement: number | null;
  status: string | null;
};

export type CitoParticipants = { eventId: string; teams: CitoParticipant[] };

export type CitoRosterEntry = {
  teamId: string;
  playerId: string;
  playerNickname: string;
  playerName: string | null;
  playerImageUrl: string | null;
  playerSlug: string;
  countryName: string | null;
  countryCode: string | null;
  age: number | null;
  rating: number | null;
  mapsPlayed: number | null;
  role: string | null;
  fromAt: string | null;
  toAt: string | null;
  isActive: boolean;
};

export type CitoMatchMap = {
  id: string;
  matchId: string;
  mapNumber: number;
  mapName: string | null;
  status: string;
  team1Score: number | null;
  team2Score: number | null;
  winnerTeamId: string | null;
  durationRounds: number | null;
  pickTeamId: string | null;
  isForfeit: boolean | null;
};

export type CitoMatch = {
  id: string;
  eventId: string;
  stageName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  bestOf: number | null;
  status: string;
  team1Id: string | null;
  team2Id: string | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerTeamId: string | null;
  isForfeit: boolean | null;
  team1: CitoTeam | null;
  team2: CitoTeam | null;
  maps: CitoMatchMap[];
};

export type CitoPlayerStat = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  kills: number;
  deaths: number;
  assists: number;
  plusMinus: number | null;
  adr: number | null;
  kast: number | null;
  rating: number | null;
  headshots: number | null;
  headshotPercent: number | null;
  openingKills: number | null;
  openingDeaths: number | null;
};

export type CitoGame = {
  id: string;
  matchId: string;
  mapNumber: number;
  map: string | null;
  winnerTeamId: string | null;
  score: { team1: number | null; team2: number | null } | null;
  durationRounds: number | null;
  status: string;
  isForfeit: boolean | null;
  pickTeamId: string | null;
  playerStats: CitoPlayerStat[];
};

type CitoResponse<T> = { success: boolean; data: T; meta?: Record<string, unknown> };

export class CitoError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Cito ${path} failed with HTTP ${status}`);
  }
}

const MAX_RETRIES = 3;
const DEFAULT_WAIT_S = 60;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cito allows about 10 calls per minute. On HTTP 429 we wait as long as the API asks (Retry-After) and retry.
export async function citoGet<T>(apiKey: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "x-api-key": apiKey, accept: "application/json" } });
    const remaining = res.headers.get("x-ratelimit-monthly-remaining");
    console.log(`[cito] GET ${path} -> ${res.status} (monthly calls left: ${remaining ?? "?"})`);
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const waitS = Number(res.headers.get("retry-after")) || DEFAULT_WAIT_S;
      console.log(`[cito] rate limited, waiting ${waitS}s`);
      await sleep(Math.min(waitS, 120) * 1000);
      continue;
    }
    if (!res.ok) throw new CitoError(res.status, path);
    // Slow down before the per-minute limit is reached.
    if (Number(res.headers.get("x-ratelimit-remaining-minute") ?? 10) <= 1) await sleep(DEFAULT_WAIT_S * 1000);
    return (await res.json()) as CitoResponse<T>;
  }
}
