// Loads one tournament's teams, rosters, matches and map stats from Cito.
// Call cost: teams = 1 + one per team whose roster is older than 24 hours; matches = 1; stats = 1 per finished match.

const ROSTER_TTL_MS = 24 * 3_600_000;

import { createDb, type Db, schema } from "@cs-vv-fantasy/db";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { type CitoGame, type CitoMatch, type CitoParticipants, type CitoRosterEntry, citoGet } from "./cito";
import { ingestGames, ingestMatches, ingestParticipants, ingestRoster, ingestTeams, resolveIds } from "./ingest";
import { scoreMatch } from "./score";

async function providerId(db: Db, entityType: string, internalId: string) {
  const [row] = await db
    .select({ providerId: schema.externalIds.providerId })
    .from(schema.externalIds)
    .where(
      and(
        eq(schema.externalIds.provider, "cito"),
        eq(schema.externalIds.entityType, entityType),
        eq(schema.externalIds.internalId, internalId),
      ),
    )
    .limit(1);
  if (!row) throw new Error(`No Cito ID for ${entityType} ${internalId}`);
  return row.providerId;
}

async function saveRaw(env: CloudflareEnv, key: string, body: unknown) {
  await env.STORAGE.put(`raw/cito/${key}/${new Date().toISOString()}.json`, JSON.stringify(body), {
    httpMetadata: { contentType: "application/json" },
  });
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function syncTournamentTeams(env: CloudflareEnv, tournamentId: string) {
  const db = createDb(env.DB);
  const eventId = await providerId(db, "tournament", tournamentId);
  const body = await citoGet<CitoParticipants>(env.CITO_API_KEY, `/cs2/events/${eventId}/participants`, { limit: "64" });
  await saveRaw(env, `participants/${eventId}`, body);
  const participants = body.data?.teams ?? [];

  // Participants carry only ID and name. Full team details arrive with the matches.
  await ingestTeams(
    db,
    "cito",
    participants.map((p) => ({
      id: p.teamId,
      name: p.teamName,
      slug: slugify(p.teamName) || p.teamId,
      teamTag: null,
      countryName: null,
      countryCode: null,
      region: null,
      worldRanking: null,
      vrsRanking: null,
      logoUrl: null,
    })),
  );
  await ingestParticipants(db, "cito", tournamentId, participants);

  // Rosters loaded in the last 24 hours are reused (a team can play several tournaments).
  const { map: teamIds } = await resolveIds(
    db,
    "cito",
    "team",
    participants.map((p) => p.teamId),
  );
  const fresh = new Set(
    (
      await db
        .select({ id: schema.teams.id })
        .from(schema.teams)
        .where(and(inArray(schema.teams.id, [...teamIds.values()]), gt(schema.teams.rosterSyncedAt, new Date(Date.now() - ROSTER_TTL_MS))))
    ).map((t) => t.id),
  );
  let calls = 1;
  let reused = 0;
  for (const p of participants) {
    const teamId = teamIds.get(p.teamId)!;
    if (fresh.has(teamId)) {
      reused++;
      continue;
    }
    const roster = await citoGet<CitoRosterEntry[]>(env.CITO_API_KEY, `/cs2/teams/${p.teamId}/roster`);
    calls++;
    await saveRaw(env, `roster/${p.teamId}`, roster);
    await ingestRoster(db, "cito", p.teamId, roster.data ?? []);
    await db.update(schema.teams).set({ rosterSyncedAt: new Date() }).where(eq(schema.teams.id, teamId));
  }
  await db.update(schema.tournaments).set({ dataSource: "cito" }).where(eq(schema.tournaments.id, tournamentId));
  const players = await db
    .select({ id: schema.teamPlayers.playerId })
    .from(schema.teamPlayers)
    .where(and(inArray(schema.teamPlayers.teamId, [...teamIds.values()]), eq(schema.teamPlayers.isActive, true)));
  return { teams: participants.length, players: players.length, calls, reused };
}

export async function syncTournamentMatches(env: CloudflareEnv, tournamentId: string) {
  const db = createDb(env.DB);
  const eventId = await providerId(db, "tournament", tournamentId);
  const body = await citoGet<CitoMatch[]>(env.CITO_API_KEY, `/cs2/events/${eventId}/matches`, { limit: "200" });
  await saveRaw(env, `matches/${eventId}`, body);
  const result = await ingestMatches(db, "cito", tournamentId, body.data ?? []);
  await db.update(schema.tournaments).set({ dataSource: "cito" }).where(eq(schema.tournaments.id, tournamentId));
  return { ...result, calls: 1 };
}

/** Fetches map stats for finished matches that have none yet, then scores them. */
export async function syncTournamentStats(env: CloudflareEnv, tournamentId: string, maxCalls: number) {
  const db = createDb(env.DB);
  const pending = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.tournamentId, tournamentId),
        inArray(schema.matches.status, ["completed", "finished"]),
        isNull(schema.matches.statsSyncedAt),
      ),
    )
    .limit(maxCalls);
  let maps = 0;
  for (const m of pending) {
    const matchProviderId = await providerId(db, "match", m.id);
    // Fake matches on real teams (test data) have no stats at Cito.
    if (matchProviderId.startsWith("fake-")) continue;
    const body = await citoGet<CitoGame[]>(env.CITO_API_KEY, `/cs2/matches/${matchProviderId}/games`);
    await saveRaw(env, `games/${matchProviderId}`, body);
    const result = await ingestGames(db, "cito", matchProviderId, body.data ?? []);
    maps += result.mapIds.length;
    await scoreMatch(db, result.matchId);
  }
  return { matches: pending.length, maps, calls: pending.length };
}
