import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAME_CONFIG,
  type GameConfig,
  mapPointsForRole,
  parseGameConfig,
  scoreMap,
  seriesPoints,
  suggestPrice,
} from "../packages/scoring/src";

const config = DEFAULT_GAME_CONFIG;

// docs/PLAN.md section 3.4 example, without the stats Cito does not provide (multi-kills, clutches).
const solid = {
  kills: 20,
  deaths: 16,
  assists: 5,
  adr: 85,
  kast: 0.74,
  rating: 1.15,
  headshots: 10,
  openingKills: 3,
  openingDeaths: 2,
};
const won = { rounds: 24, teamWonMap: true, teamWonSeriesOnThisMap: false, teamRank: 10, opponentRank: 4 };

describe("scoreMap", () => {
  it("scores the plan's solid map at 39 base points", () => {
    const score = scoreMap(solid, won, config);
    // 40 - 16 + 5 + 6 - 2 + ADR 1 + rating 2 + map win 3
    expect(score.base).toBe(39);
    expect(score.breakdown.map((i) => i.key)).toEqual([
      "kills",
      "deaths",
      "assists",
      "openingKills",
      "openingDeaths",
      "adr",
      "rating",
      "mapWin",
    ]);
  });

  it("computes every role bonus", () => {
    const { roleBonus } = scoreMap(solid, won, config);
    expect(roleBonus).toEqual({
      spearhead: 8, // 3 × 2 + refund 2 opening deaths
      sharpshooter: 5, // 10 × 0.5
      anchor: 2, // KAST 74%
      workhorse: 1.5, // (85 - 70) / 10
      survivor: 2, // (24 - 16) × 0.25
      enabler: 5,
      underdog: 4, // rank 10 beat rank 4
    });
  });

  it("gives the series win only on the deciding map", () => {
    const decider = scoreMap(solid, { ...won, teamWonSeriesOnThisMap: true }, config);
    expect(decider.base).toBe(41);
  });

  it("handles missing stats and lost maps", () => {
    const empty = scoreMap(
      { kills: 5, deaths: 18, assists: 1, adr: null, kast: null, rating: 0.6, headshots: null, openingKills: null, openingDeaths: null },
      { rounds: null, teamWonMap: false, teamWonSeriesOnThisMap: false, teamRank: null, opponentRank: null },
      config,
    );
    expect(empty.base).toBe(10 - 18 + 1 - 4);
    expect(empty.roleBonus.underdog).toBe(0);
    expect(empty.roleBonus.survivor).toBe(0);
  });

  it("skips disabled roles", () => {
    const off: GameConfig = { ...config, roles: { ...config.roles, underdog: { ...config.roles.underdog, enabled: false } } };
    expect(scoreMap(solid, won, off).roleBonus).not.toHaveProperty("underdog");
  });

  it("adds the chosen role to the base", () => {
    const score = scoreMap(solid, won, config);
    expect(mapPointsForRole(score, "spearhead")).toBe(47);
    expect(mapPointsForRole(score, null)).toBe(39);
  });
});

describe("seriesPoints", () => {
  it("averages and multiplies by the format factor", () => {
    expect(seriesPoints([30, 10, 20], 3, config)).toBe(40);
    expect(seriesPoints([30, 10], 3, config)).toBe(40);
    expect(seriesPoints([25], 1, config)).toBe(25);
  });

  it("sums all maps in sum mode", () => {
    const sum: GameConfig = { ...config, format: { ...config.format, mapCountMode: "sum" } };
    expect(seriesPoints([30, 10, 20], 3, sum)).toBe(60);
  });
});

describe("suggestPrice", () => {
  it("stays inside the price range, on the step", () => {
    for (const [rating, rank] of [
      [0.5, 200],
      [1.0, 30],
      [1.4, 1],
      [null, null],
    ] as const) {
      const price = suggestPrice(rating, rank, config);
      expect(price).toBeGreaterThanOrEqual(config.pricing.minPrice);
      expect(price).toBeLessThanOrEqual(config.pricing.maxPrice);
      expect(price % config.pricing.step).toBe(0);
    }
  });

  it("prices a top player on a top team at the maximum", () => {
    expect(suggestPrice(1.4, 1, config)).toBe(config.pricing.maxPrice);
  });
});

describe("parseGameConfig", () => {
  it("accepts the default config and rejects a broken one", () => {
    expect(parseGameConfig(DEFAULT_GAME_CONFIG)).toEqual(DEFAULT_GAME_CONFIG);
    expect(() => parseGameConfig({ ...DEFAULT_GAME_CONFIG, roster: { size: 0 } })).toThrow();
  });
});
