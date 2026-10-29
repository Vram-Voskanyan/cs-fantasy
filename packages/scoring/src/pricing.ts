import type { GameConfig } from "./config";

// Suggested price in credits ×10, from the player's rating and the team's VRS ranking.
export function suggestPrice(rating: number | null, teamRank: number | null, config: GameConfig) {
  const p = config.pricing;
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const ratingScore = clamp01(((rating ?? p.defaultRating) - p.ratingLow) / (p.ratingHigh - p.ratingLow));
  const rankScore = teamRank === null ? 0.5 : clamp01((p.rankWorst - teamRank) / (p.rankWorst - p.rankBest));
  const weightSum = p.ratingWeight + p.rankWeight || 1;
  const score = (ratingScore * p.ratingWeight + rankScore * p.rankWeight) / weightSum;
  const raw = p.minPrice + score * (p.maxPrice - p.minPrice);
  const stepped = Math.round(raw / p.step) * p.step;
  return Math.min(p.maxPrice, Math.max(p.minPrice, stepped));
}
