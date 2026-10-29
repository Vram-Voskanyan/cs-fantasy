// Scores finished maps and recomputes fantasy team totals (docs/PLAN.md section 7).

import { type Db, type FantasyStage, schema } from "@cs-vv-fantasy/db";
import { type MapScore, mapPointsForRole, type RoleId, scoreMap, seriesPoints } from "@cs-vv-fantasy/scoring";
import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getGameConfig, getStages, stageForMatch } from "./game";

const FINISHED = ["completed", "finished"];

/** Scores every player on every finished map of a match, then updates the tournament's fantasy totals. */
export async function scoreMatch(db: Db, matchId: string) {
  const [match] = await db.select().from(schema.matches).where(eq(schema.matches.id, matchId)).limit(1);
  if (!match) return;
  const { config, version } = await getGameConfig(db, match.tournamentId);
  const maps = (await db.select().from(schema.matchMaps).where(eq(schema.matchMaps.matchId, matchId))).filter(
    (m) => FINISHED.includes(m.status) && !m.isForfeit,
  );
  if (maps.length === 0) return;
  const stats = await db
    .select()
    .from(schema.playerMapStats)
    .where(
      inArray(
        schema.playerMapStats.mapId,
        maps.map((m) => m.id),
      ),
    );
  const teamIds = [match.team1Id, match.team2Id].filter((x): x is string => !!x);
  const ranks = new Map(
    (await db.select({ id: schema.teams.id, rank: schema.teams.vrsRanking }).from(schema.teams).where(inArray(schema.teams.id, teamIds))).map((t) => [
      t.id,
      t.rank,
    ]),
  );
  const seriesFinished = FINISHED.includes(match.status) && !!match.winnerTeamId;
  const lastMapNumber = Math.max(...maps.map((m) => m.mapNumber));
  const scoredAt = new Date();

  const statements: BatchItem<"sqlite">[] = stats.map((s) => {
    const map = maps.find((m) => m.id === s.mapId)!;
    const opponent = s.teamId === match.team1Id ? match.team2Id : match.team1Id;
    const score = scoreMap(
      s,
      {
        rounds: map.durationRounds,
        teamWonMap: !!s.teamId && map.winnerTeamId === s.teamId,
        teamWonSeriesOnThisMap: seriesFinished && map.mapNumber === lastMapNumber && match.winnerTeamId === s.teamId,
        teamRank: s.teamId ? (ranks.get(s.teamId) ?? null) : null,
        opponentRank: opponent ? (ranks.get(opponent) ?? null) : null,
      },
      config,
    );
    const values = {
      base: score.base,
      breakdownJson: JSON.stringify(score.breakdown),
      roleBonusJson: JSON.stringify(score.roleBonus),
      configVersion: version,
      scoredAt,
    };
    return db
      .insert(schema.playerMapPoints)
      .values({ mapId: s.mapId, playerId: s.playerId, ...values })
      .onConflictDoUpdate({ target: [schema.playerMapPoints.mapId, schema.playerMapPoints.playerId], set: values });
  });
  for (let i = 0; i < statements.length; i += 50) {
    const [first, ...rest] = statements.slice(i, i + 50);
    if (first) await db.batch([first, ...rest]);
  }
  await recomputeTournamentScores(db, match.tournamentId);
}

/** Re-scores every finished match of a tournament, for example after a config change. */
export async function rescoreTournament(db: Db, tournamentId: string) {
  const rows = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(and(eq(schema.matches.tournamentId, tournamentId), inArray(schema.matches.status, FINISHED)));
  for (const r of rows) await scoreMatch(db, r.id);
  if (rows.length === 0) await recomputeTournamentScores(db, tournamentId);
  return { matches: rows.length };
}

export type PlayerMatchPoints = {
  matchId: string;
  points: number;
  maps: { mapId: string; mapNumber: number; mapName: string | null; base: number; roleBonus: number; breakdown: MapScore["breakdown"] }[];
};

export type ScoringData = Awaited<ReturnType<typeof loadScoringData>>;

/** Loads everything needed to compute fantasy points for one tournament. */
export async function loadScoringData(db: Db, tournamentId: string) {
  const [{ config }, stages, matches] = await Promise.all([
    getGameConfig(db, tournamentId),
    getStages(db, tournamentId),
    db.select().from(schema.matches).where(eq(schema.matches.tournamentId, tournamentId)),
  ]);
  const matchIds = matches.map((m) => m.id);
  const maps = matchIds.length ? await db.select().from(schema.matchMaps).where(inArray(schema.matchMaps.matchId, matchIds)) : [];
  const mapIds = maps.map((m) => m.id);
  const points: (typeof schema.playerMapPoints.$inferSelect)[] = [];
  for (let i = 0; i < mapIds.length; i += 90) {
    points.push(...(await db.select().from(schema.playerMapPoints).where(inArray(schema.playerMapPoints.mapId, mapIds.slice(i, i + 90)))));
  }
  return { config, stages, matches, maps, points };
}

/** One player's points per match in a stage, with the chosen role. */
export function playerStagePoints(data: ScoringData, stage: FantasyStage, playerId: string, role: RoleId | null): PlayerMatchPoints[] {
  const { config, stages, matches, maps, points } = data;
  const result: PlayerMatchPoints[] = [];
  for (const match of matches) {
    if (stageForMatch(stages, match.startsAt)?.id !== stage.id) continue;
    const matchMaps = maps.filter((m) => m.matchId === match.id).sort((a, b) => a.mapNumber - b.mapNumber);
    const rows = matchMaps
      .map((map) => {
        const p = points.find((x) => x.mapId === map.id && x.playerId === playerId);
        if (!p) return null;
        const roleBonus = JSON.parse(p.roleBonusJson) as Partial<Record<RoleId, number>>;
        return {
          mapId: map.id,
          mapNumber: map.mapNumber,
          mapName: map.mapName,
          base: p.base,
          roleBonus: role ? (roleBonus[role] ?? 0) : 0,
          breakdown: JSON.parse(p.breakdownJson) as MapScore["breakdown"],
          total: mapPointsForRole({ base: p.base, roleBonus }, role),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (rows.length === 0) continue;
    result.push({
      matchId: match.id,
      points: seriesPoints(
        rows.map((r) => r.total),
        match.bestOf,
        config,
      ),
      maps: rows.map((r) => ({ mapId: r.mapId, mapNumber: r.mapNumber, mapName: r.mapName, base: r.base, roleBonus: r.roleBonus, breakdown: r.breakdown })),
    });
  }
  return result;
}

type Pick = { playerId: string; role: string | null; stageId: string };

/** Picks that count for a stage: the stage's own picks, else the latest earlier stage's picks (roster carries over). */
export function picksForStage(stages: FantasyStage[], picks: Pick[], stage: FantasyStage) {
  const ordered = stages.filter((s) => s.lockAt <= stage.lockAt).reverse();
  for (const s of ordered) {
    const own = picks.filter((p) => p.stageId === s.id);
    if (own.length > 0) return own;
  }
  return [];
}

export function teamStagePoints(data: ScoringData, picks: Pick[], stage: FantasyStage) {
  return picksForStage(data.stages, picks, stage).reduce(
    (sum, p) => sum + playerStagePoints(data, stage, p.playerId, (p.role as RoleId | null) ?? null).reduce((s, m) => s + m.points, 0),
    0,
  );
}

export async function recomputeTournamentScores(db: Db, tournamentId: string) {
  const data = await loadScoringData(db, tournamentId);
  const teams = await db.select({ id: schema.fantasyTeams.id }).from(schema.fantasyTeams).where(eq(schema.fantasyTeams.tournamentId, tournamentId));
  if (teams.length === 0 || data.stages.length === 0) return;
  const picks = await db
    .select()
    .from(schema.fantasyPicks)
    .where(
      inArray(
        schema.fantasyPicks.fantasyTeamId,
        teams.map((t) => t.id),
      ),
    );
  const statements: BatchItem<"sqlite">[] = [];
  for (const team of teams) {
    const own = picks.filter((p) => p.fantasyTeamId === team.id);
    for (const stage of data.stages) {
      const points = Math.round(teamStagePoints(data, own, stage) * 100) / 100;
      statements.push(
        db
          .insert(schema.fantasyTeamScores)
          .values({ fantasyTeamId: team.id, stageId: stage.id, points })
          .onConflictDoUpdate({ target: [schema.fantasyTeamScores.fantasyTeamId, schema.fantasyTeamScores.stageId], set: { points } }),
      );
    }
  }
  for (let i = 0; i < statements.length; i += 50) {
    const [first, ...rest] = statements.slice(i, i + 50);
    if (first) await db.batch([first, ...rest]);
  }
}
