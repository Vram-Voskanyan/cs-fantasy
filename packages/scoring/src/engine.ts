import type { GameConfig, RoleId } from "./config";
import { enabledRoles } from "./config";

// Per-map stats as the data provider returns them (Cito /matches/{id}/games playerStats).
export type MapStats = {
  kills: number;
  deaths: number;
  assists: number;
  adr: number | null;
  kast: number | null; // 0..1
  rating: number | null;
  headshots: number | null;
  openingKills: number | null;
  openingDeaths: number | null;
};

export type MapContext = {
  rounds: number | null;
  teamWonMap: boolean;
  // True only on the last map of a finished series that the player's team won.
  teamWonSeriesOnThisMap: boolean;
  teamRank: number | null; // VRS ranking, lower is better
  opponentRank: number | null;
};

export type BreakdownItem = { key: string; count?: number; points: number };

export type MapScore = {
  base: number;
  breakdown: BreakdownItem[];
  roleBonus: Partial<Record<RoleId, number>>;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function tierPoints(value: number | null, tiers: { min: number; points: number }[]) {
  if (value === null) return 0;
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  return sorted.find((t) => value >= t.min)?.points ?? 0;
}

function addCount(items: BreakdownItem[], key: string, count: number | null, perUnit: number) {
  if (!count || perUnit === 0) return;
  items.push({ key, count, points: round2(count * perUnit) });
}

export function scoreMap(stats: MapStats, ctx: MapContext, config: GameConfig): MapScore {
  const s = config.scoring;
  const items: BreakdownItem[] = [];
  addCount(items, "kills", stats.kills, s.kill);
  addCount(items, "deaths", stats.deaths, s.death);
  addCount(items, "assists", stats.assists, s.assist);
  addCount(items, "headshots", stats.headshots, s.headshot);
  addCount(items, "openingKills", stats.openingKills, s.openingKill);
  addCount(items, "openingDeaths", stats.openingDeaths, s.openingDeath);
  const adr = tierPoints(stats.adr, s.adrTiers);
  if (adr) items.push({ key: "adr", points: adr });
  const rating = tierPoints(stats.rating, s.ratingTiers);
  if (rating) items.push({ key: "rating", points: rating });
  if (ctx.teamWonMap && s.mapWin) items.push({ key: "mapWin", points: s.mapWin });
  if (ctx.teamWonSeriesOnThisMap && s.seriesWin) items.push({ key: "seriesWin", points: s.seriesWin });

  const r = config.roles;
  const bonus: Partial<Record<RoleId, number>> = {};
  for (const role of enabledRoles(config)) {
    let value = 0;
    if (role === "spearhead") {
      value = (stats.openingKills ?? 0) * r.spearhead.perOpeningKill;
      if (r.spearhead.refundOpeningDeaths) value -= (stats.openingDeaths ?? 0) * s.openingDeath;
    } else if (role === "sharpshooter") {
      value = (stats.headshots ?? 0) * r.sharpshooter.perHeadshot;
    } else if (role === "anchor") {
      value = tierPoints(stats.kast, r.anchor.kastTiers);
    } else if (role === "workhorse") {
      value = stats.adr === null ? 0 : (Math.max(0, stats.adr - r.workhorse.adrBase) / 10) * r.workhorse.pointsPer10Adr;
    } else if (role === "survivor") {
      value = ctx.rounds === null ? 0 : Math.max(0, ctx.rounds - stats.deaths) * r.survivor.perRoundSurvived;
    } else if (role === "enabler") {
      value = stats.assists * r.enabler.perAssist;
    } else if (role === "underdog") {
      const lowerRanked = ctx.teamRank !== null && ctx.opponentRank !== null && ctx.teamRank > ctx.opponentRank;
      value = ctx.teamWonMap && lowerRanked ? r.underdog.mapWinBonus : 0;
    }
    bonus[role] = round2(value);
  }

  return { base: round2(items.reduce((sum, i) => sum + i.points, 0)), breakdown: items, roleBonus: bonus };
}

/** Points for one map with a given role (null = no role). */
export function mapPointsForRole(score: Pick<MapScore, "base" | "roleBonus">, role: RoleId | null) {
  return round2(score.base + (role ? (score.roleBonus[role] ?? 0) : 0));
}

/** Combines a player's map points in one series, using the map-count mode. */
export function seriesPoints(mapPoints: number[], bestOf: number | null, config: GameConfig) {
  if (mapPoints.length === 0) return 0;
  const total = mapPoints.reduce((a, b) => a + b, 0);
  if (config.format.mapCountMode === "sum") return round2(total);
  const factors = config.format.factors;
  const factor = bestOf === 1 ? factors.bo1 : bestOf === 3 ? factors.bo3 : bestOf === 5 ? factors.bo5 : mapPoints.length;
  return round2((total / mapPoints.length) * factor);
}
