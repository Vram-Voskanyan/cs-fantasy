import "server-only";
import { type Db, schema } from "@cs-vv-fantasy/db";
import { desc, eq, sql } from "drizzle-orm";

export type LeaderboardRow = { rank: number; userId: string; userName: string; teamName: string | null; points: number; tournaments?: number };

/** Ranks with ties: equal points share a rank. */
function withRanks<T extends { points: number }>(rows: T[]) {
  let rank = 0;
  let last: number | null = null;
  return rows.map((r, i) => {
    if (r.points !== last) rank = i + 1;
    last = r.points;
    return { ...r, rank };
  });
}

export async function tournamentLeaderboard(db: Db, tournamentId: string): Promise<LeaderboardRow[]> {
  const points = sql<number>`coalesce(sum(${schema.fantasyTeamScores.points}), 0)`;
  const rows = await db
    .select({ userId: schema.user.id, userName: schema.user.name, teamName: schema.fantasyTeams.name, points })
    .from(schema.fantasyTeams)
    .innerJoin(schema.user, eq(schema.user.id, schema.fantasyTeams.userId))
    .leftJoin(schema.fantasyTeamScores, eq(schema.fantasyTeamScores.fantasyTeamId, schema.fantasyTeams.id))
    .where(eq(schema.fantasyTeams.tournamentId, tournamentId))
    .groupBy(schema.fantasyTeams.id)
    .orderBy(desc(points), schema.fantasyTeams.createdAt);
  return withRanks(rows.map((r) => ({ ...r, points: Math.round(Number(r.points) * 100) / 100 })));
}

export async function overallLeaderboard(db: Db): Promise<LeaderboardRow[]> {
  const points = sql<number>`coalesce(sum(${schema.fantasyTeamScores.points}), 0)`;
  const tournaments = sql<number>`count(distinct ${schema.fantasyTeams.tournamentId})`;
  const rows = await db
    .select({ userId: schema.user.id, userName: schema.user.name, points, tournaments })
    .from(schema.fantasyTeams)
    .innerJoin(schema.user, eq(schema.user.id, schema.fantasyTeams.userId))
    .leftJoin(schema.fantasyTeamScores, eq(schema.fantasyTeamScores.fantasyTeamId, schema.fantasyTeams.id))
    .groupBy(schema.user.id)
    .orderBy(desc(points));
  return withRanks(rows.map((r) => ({ ...r, teamName: null, points: Math.round(Number(r.points) * 100) / 100, tournaments: Number(r.tournaments) })));
}
