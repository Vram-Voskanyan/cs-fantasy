import "server-only";
import { type Db, schema, type Tournament } from "@cs-vv-fantasy/db";
import { enabledRoles } from "@cs-vv-fantasy/scoring";
import { and, asc, eq } from "drizzle-orm";
import { getGameConfig, getStages, lockedStage, openStage } from "@/jobs/game";

export type PoolPlayer = {
  playerId: string;
  slug: string;
  nickname: string;
  countryCode: string | null;
  rating: number | null;
  citoRole: string | null;
  teamId: string;
  teamName: string;
  teamTag: string | null;
  price: number;
};

export async function loadPool(db: Db, tournamentId: string): Promise<PoolPlayer[]> {
  const rows = await db
    .select({
      playerId: schema.players.id,
      slug: schema.players.slug,
      nickname: schema.players.nickname,
      countryCode: schema.players.countryCode,
      rating: schema.players.rating,
      citoRole: schema.teamPlayers.role,
      teamId: schema.teams.id,
      teamName: schema.teams.name,
      teamTag: schema.teams.tag,
      price: schema.poolPlayers.price,
    })
    .from(schema.poolPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.poolPlayers.playerId))
    .innerJoin(schema.teams, eq(schema.teams.id, schema.poolPlayers.teamId))
    .leftJoin(schema.teamPlayers, and(eq(schema.teamPlayers.playerId, schema.players.id), eq(schema.teamPlayers.teamId, schema.teams.id)))
    .where(and(eq(schema.poolPlayers.tournamentId, tournamentId), eq(schema.poolPlayers.isAvailable, true)))
    .orderBy(asc(schema.teams.name), asc(schema.players.nickname));
  return rows;
}

export async function loadMyTeam(db: Db, tournamentId: string, userId: string) {
  const [team] = await db
    .select()
    .from(schema.fantasyTeams)
    .where(and(eq(schema.fantasyTeams.tournamentId, tournamentId), eq(schema.fantasyTeams.userId, userId)))
    .limit(1);
  if (!team) return null;
  const [picks, scores] = await Promise.all([
    db.select().from(schema.fantasyPicks).where(eq(schema.fantasyPicks.fantasyTeamId, team.id)),
    db.select().from(schema.fantasyTeamScores).where(eq(schema.fantasyTeamScores.fantasyTeamId, team.id)),
  ]);
  return { team, picks, scores, total: Math.round(scores.reduce((s, x) => s + x.points, 0) * 100) / 100 };
}

/** Everything the tournament and team pages need about the fantasy game. */
export async function loadGame(db: Db, tournament: Tournament, userId: string | null, now = new Date()) {
  const [{ config }, stages] = await Promise.all([getGameConfig(db, tournament.id), getStages(db, tournament.id)]);
  const editableStage = tournament.fantasyStatus === "open" ? openStage(stages, now) : null;
  const playingStage = lockedStage(stages, now);
  const mine = userId ? await loadMyTeam(db, tournament.id, userId) : null;
  return { config, roles: enabledRoles(config), stages, editableStage, playingStage, mine };
}
