"use server";

import { schema } from "@cs-vv-fantasy/db";
import { enabledRoles, type RoleId } from "@cs-vv-fantasy/scoring";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getGameConfig, getStages, openStage } from "@/jobs/game";
import { recomputeTournamentScores } from "@/jobs/score";
import { NAME_MAX, NAME_MIN } from "@/lib/auth-rules";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export type SaveTeamInput = { name: string; picks: { playerId: string; role: string | null }[] };
export type SaveTeamResult = { ok: true } | { ok: false; error: string; values?: Record<string, string | number> };

/** Saves the user's team for the open stage. Every rule is checked here, on the server, with server time. */
export async function saveTeam(tournamentId: string, input: SaveTeamInput): Promise<SaveTeamResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "signIn" };
  const db = await getDb();
  const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, tournamentId)).limit(1);
  if (!tournament || tournament.fantasyStatus !== "open") return { ok: false, error: "notOpen" };
  const stage = openStage(await getStages(db, tournamentId), new Date());
  if (!stage) return { ok: false, error: "notOpen" };

  const { config } = await getGameConfig(db, tournamentId);
  const name = input.name.trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return { ok: false, error: "name" };
  const picks = input.picks;
  if (picks.length !== config.roster.size) return { ok: false, error: "wrongSize", values: { size: config.roster.size } };
  const ids = picks.map((p) => p.playerId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "duplicate" };

  const pool = await db
    .select()
    .from(schema.poolPlayers)
    .where(and(eq(schema.poolPlayers.tournamentId, tournamentId), inArray(schema.poolPlayers.playerId, ids), eq(schema.poolPlayers.isAvailable, true)));
  if (pool.length !== ids.length) return { ok: false, error: "notInPool" };
  const spent = pool.reduce((s, p) => s + p.price, 0);
  if (spent > config.roster.budget) return { ok: false, error: "budget" };
  const perTeam = new Map<string, number>();
  for (const p of pool) perTeam.set(p.teamId, (perTeam.get(p.teamId) ?? 0) + 1);
  if ([...perTeam.values()].some((n) => n > config.roster.maxPerTeam)) return { ok: false, error: "teamLimit", values: { max: config.roster.maxPerTeam } };

  const roles = enabledRoles(config);
  if (roles.length > 0) {
    if (picks.some((p) => !p.role || !roles.includes(p.role as RoleId))) return { ok: false, error: "roleMissing" };
    if (config.roster.uniqueRoles && new Set(picks.map((p) => p.role)).size !== picks.length) return { ok: false, error: "roleDuplicate" };
  }

  const [existing] = await db
    .select()
    .from(schema.fantasyTeams)
    .where(and(eq(schema.fantasyTeams.tournamentId, tournamentId), eq(schema.fantasyTeams.userId, session.user.id)))
    .limit(1);
  const teamId = existing?.id ?? crypto.randomUUID();
  const price = new Map(pool.map((p) => [p.playerId, p.price]));
  await db.batch([
    existing
      ? db.update(schema.fantasyTeams).set({ name }).where(eq(schema.fantasyTeams.id, teamId))
      : db.insert(schema.fantasyTeams).values({ id: teamId, userId: session.user.id, tournamentId, name }),
    db.delete(schema.fantasyPicks).where(and(eq(schema.fantasyPicks.fantasyTeamId, teamId), eq(schema.fantasyPicks.stageId, stage.id))),
    ...picks.map((p) =>
      db.insert(schema.fantasyPicks).values({
        fantasyTeamId: teamId,
        stageId: stage.id,
        playerId: p.playerId,
        role: roles.length > 0 ? p.role : null,
        priceAtPick: price.get(p.playerId)!,
      }),
    ),
  ]);
  await recomputeTournamentScores(db, tournamentId);
  revalidatePath(`/tournaments/${tournament.slug}`);
  revalidatePath(`/tournaments/${tournament.slug}/team`);
  return { ok: true };
}
