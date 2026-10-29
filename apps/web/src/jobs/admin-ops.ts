// Admin operations shared by the admin panel (server actions) and token-protected internal routes.

import { type Db, schema, type Tournament } from "@cs-vv-fantasy/db";
import { suggestPrice } from "@cs-vv-fantasy/scoring";
import { and, eq } from "drizzle-orm";
import { getGameConfig, getStages } from "./game";

export async function setFantasyStatus(db: Db, tournament: Tournament, status: (typeof schema.fantasyStatuses)[number]) {
  await db.update(schema.tournaments).set({ fantasyStatus: status }).where(eq(schema.tournaments.id, tournament.id));
  // A fantasy game needs at least one stage. Default: one stage that locks at the tournament start.
  if (status !== "none" && (await getStages(db, tournament.id)).length === 0) {
    await db.insert(schema.fantasyStages).values({
      id: crypto.randomUUID(),
      tournamentId: tournament.id,
      order: 1,
      name: "Main stage",
      lockAt: tournament.startsAt ?? new Date(Date.now() + 86_400_000),
    });
  }
}

/** Adds every active player of the tournament's teams to the pool, with a suggested price (all, or only new players). */
export async function buildPool(db: Db, tournamentId: string, repriceAll: boolean) {
  const { config } = await getGameConfig(db, tournamentId);
  const rows = await db
    .select({ playerId: schema.players.id, rating: schema.players.rating, teamId: schema.teams.id, rank: schema.teams.vrsRanking })
    .from(schema.tournamentTeams)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.tournamentTeams.teamId))
    .innerJoin(schema.teamPlayers, and(eq(schema.teamPlayers.teamId, schema.teams.id), eq(schema.teamPlayers.isActive, true)))
    .innerJoin(schema.players, eq(schema.players.id, schema.teamPlayers.playerId))
    .where(eq(schema.tournamentTeams.tournamentId, tournamentId));
  const existing = new Set(
    (await db.select({ id: schema.poolPlayers.playerId }).from(schema.poolPlayers).where(eq(schema.poolPlayers.tournamentId, tournamentId))).map((r) => r.id),
  );
  const statements = rows
    .filter((r) => repriceAll || !existing.has(r.playerId))
    .map((r) => {
      const price = suggestPrice(r.rating, r.rank, config);
      return db
        .insert(schema.poolPlayers)
        .values({ tournamentId, playerId: r.playerId, teamId: r.teamId, price, isAvailable: true })
        .onConflictDoUpdate({ target: [schema.poolPlayers.tournamentId, schema.poolPlayers.playerId], set: { price, teamId: r.teamId } });
    });
  for (let i = 0; i < statements.length; i += 50) {
    const [first, ...rest] = statements.slice(i, i + 50);
    if (first) await db.batch([first, ...rest]);
  }
  return { count: new Set([...existing, ...rows.map((r) => r.playerId)]).size };
}

/**
 * Removes a tournament's teams, matches (with maps, stats and points), player pool and fantasy teams,
 * so it can be reloaded from another source (for example fake data, then real Cito data).
 * Team and player rows stay: other tournaments may use them.
 */
export async function clearTournamentData(db: Db, tournamentId: string) {
  await db.batch([
    db.delete(schema.fantasyTeams).where(eq(schema.fantasyTeams.tournamentId, tournamentId)),
    db.delete(schema.poolPlayers).where(eq(schema.poolPlayers.tournamentId, tournamentId)),
    db.delete(schema.matches).where(eq(schema.matches.tournamentId, tournamentId)),
    db.delete(schema.tournamentTeams).where(eq(schema.tournamentTeams.tournamentId, tournamentId)),
    db.update(schema.tournaments).set({ dataSource: null }).where(eq(schema.tournaments.id, tournamentId)),
  ]);
}
