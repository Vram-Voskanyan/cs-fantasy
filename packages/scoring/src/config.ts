import { z } from "zod";

// Game config: every game number lives here, editable in the admin panel (docs/PLAN.md section 7.1).
// Only stats the data provider (Cito) returns per map are used: kills, deaths, assists, ADR, KAST,
// headshots, opening kills, opening deaths, rating, rounds, map and series result, team VRS ranking.

const points = z.number().min(-100).max(100);
const tier = z.object({ min: z.number(), points });
const tiers = z.array(tier).max(10);

export const roleIds = ["spearhead", "sharpshooter", "anchor", "workhorse", "survivor", "enabler", "underdog"] as const;
export type RoleId = (typeof roleIds)[number];

export const gameConfigSchema = z.object({
  roster: z.object({
    size: z.number().int().min(1).max(10),
    // Credits are stored ×10 (100.0 credits = 1000).
    budget: z.number().int().min(10).max(100_000),
    maxPerTeam: z.number().int().min(1).max(10),
    uniqueRoles: z.boolean(),
  }),
  scoring: z.object({
    kill: points,
    death: points,
    assist: points,
    headshot: points,
    openingKill: points,
    openingDeath: points,
    // Ordered high to low: the first tier whose `min` the value reaches gives its points.
    adrTiers: tiers,
    ratingTiers: tiers,
    mapWin: points,
    seriesWin: points,
  }),
  format: z.object({
    // "sum": all map points. "average_x_factor": average map points × factor for the series length.
    mapCountMode: z.enum(["sum", "average_x_factor"]),
    factors: z.object({ bo1: z.number().min(0).max(10), bo3: z.number().min(0).max(10), bo5: z.number().min(0).max(10) }),
  }),
  roles: z.object({
    spearhead: z.object({ enabled: z.boolean(), perOpeningKill: points, refundOpeningDeaths: z.boolean() }),
    sharpshooter: z.object({ enabled: z.boolean(), perHeadshot: points }),
    anchor: z.object({ enabled: z.boolean(), kastTiers: tiers }),
    workhorse: z.object({ enabled: z.boolean(), adrBase: z.number().min(0).max(300), pointsPer10Adr: points }),
    survivor: z.object({ enabled: z.boolean(), perRoundSurvived: points }),
    enabler: z.object({ enabled: z.boolean(), perAssist: points }),
    underdog: z.object({ enabled: z.boolean(), mapWinBonus: points }),
  }),
  pricing: z.object({
    // Credits ×10.
    minPrice: z.number().int().min(0),
    maxPrice: z.number().int().min(0),
    step: z.number().int().min(1),
    ratingLow: z.number(),
    ratingHigh: z.number(),
    defaultRating: z.number(),
    rankBest: z.number().int().min(1),
    rankWorst: z.number().int().min(2),
    ratingWeight: z.number().min(0).max(1),
    rankWeight: z.number().min(0).max(1),
  }),
});

export type GameConfig = z.infer<typeof gameConfigSchema>;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  roster: { size: 5, budget: 1000, maxPerTeam: 2, uniqueRoles: true },
  scoring: {
    kill: 2,
    death: -1,
    assist: 1,
    headshot: 0,
    openingKill: 2,
    openingDeath: -1,
    adrTiers: [
      { min: 100, points: 3 },
      { min: 85, points: 1 },
    ],
    ratingTiers: [
      { min: 1.5, points: 6 },
      { min: 1.3, points: 4 },
      { min: 1.15, points: 2 },
      { min: 0.85, points: 0 },
      { min: 0.7, points: -2 },
      { min: 0, points: -4 },
    ],
    mapWin: 3,
    seriesWin: 2,
  },
  format: { mapCountMode: "average_x_factor", factors: { bo1: 1, bo3: 2, bo5: 3 } },
  roles: {
    spearhead: { enabled: true, perOpeningKill: 2, refundOpeningDeaths: true },
    sharpshooter: { enabled: true, perHeadshot: 0.5 },
    anchor: {
      enabled: true,
      kastTiers: [
        { min: 0.8, points: 4 },
        { min: 0.7, points: 2 },
      ],
    },
    workhorse: { enabled: true, adrBase: 70, pointsPer10Adr: 1 },
    survivor: { enabled: true, perRoundSurvived: 0.25 },
    enabler: { enabled: true, perAssist: 1 },
    underdog: { enabled: true, mapWinBonus: 4 },
  },
  pricing: {
    minPrice: 120,
    maxPrice: 260,
    step: 5,
    ratingLow: 0.85,
    ratingHigh: 1.3,
    defaultRating: 1.0,
    rankBest: 1,
    rankWorst: 60,
    ratingWeight: 0.7,
    rankWeight: 0.3,
  },
};

export function parseGameConfig(input: unknown): GameConfig {
  return gameConfigSchema.parse(input);
}

export function enabledRoles(config: GameConfig): RoleId[] {
  return roleIds.filter((role) => config.roles[role].enabled);
}
