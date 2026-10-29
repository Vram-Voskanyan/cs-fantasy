// Loads one tournament's teams, rosters, matches and map stats from Cito.
// Call cost: teams = 1 + one per team whose roster is older than 24 hours; matches = 1; stats = 1 per finished match.

const ROSTER_TTL_MS = 24 * 3_600_000;

import { createDb, type Db, schema } from "@cs-vv-fantasy/db";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { type CitoGame, type CitoMatch, type CitoParticipants, type CitoRosterEntry, type CitoTeamDetails, type CitoVrsEntry, citoGet } from "./cito";
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
  // Participants carry no ranking; one call to the VRS list fills it for every known team.
  const unranked = await db
    .select({ id: schema.teams.id })
    .from(schema.teams)
    .where(and(inArray(schema.teams.id, [...teamIds.values()]), isNull(schema.teams.vrsRanking)));
  if (unranked.length > 0) {
    await syncVrsRankings(env);
    calls++;
  }
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

/** Updates the VRS rank of every team we already have (one call; does not create teams). */
export async function syncVrsRankings(env: CloudflareEnv) {
  const db = createDb(env.DB);
  const body = await citoGet<CitoVrsEntry[]>(env.CITO_API_KEY, "/cs2/rankings/vrs", { limit: "200" });
  await saveRaw(env, "rankings-vrs", body);
  const entries = body.data ?? [];
  // Only teams we already have; resolveIds would create the rest, so look them up directly (chunked: D1 allows 100 variables).
  const internal = new Map<string, string>();
  for (let i = 0; i < entries.length; i += 90) {
    const known = await db
      .select({ providerId: schema.externalIds.providerId, internalId: schema.externalIds.internalId })
      .from(schema.externalIds)
      .where(
        and(
          eq(schema.externalIds.provider, "cito"),
          eq(schema.externalIds.entityType, "team"),
          inArray(
            schema.externalIds.providerId,
            entries.slice(i, i + 90).map((e) => e.teamId),
          ),
        ),
      );
    for (const k of known) internal.set(k.providerId, k.internalId);
  }
  const statements = entries
    .filter((e) => internal.has(e.teamId))
    .map((e) => db.update(schema.teams).set({ vrsRanking: e.rank }).where(eq(schema.teams.id, internal.get(e.teamId)!)));
  for (let i = 0; i < statements.length; i += 50) {
    const [first, ...rest] = statements.slice(i, i + 50);
    if (first) await db.batch([first, ...rest]);
  }
  return { updated: statements.length };
}

/** Adds one real Cito team (details and roster in one call) to a tournament. */
export async function addTeamToTournament(env: CloudflareEnv, tournamentId: string, teamSlugOrId: string) {
  const db = createDb(env.DB);
  const body = await citoGet<CitoTeamDetails>(env.CITO_API_KEY, `/cs2/teams/${encodeURIComponent(teamSlugOrId)}`);
  await saveRaw(env, `team/${teamSlugOrId}`, body);
  const team = body.data;
  if (!team?.id) throw new Error(`Team ${teamSlugOrId} not found at Cito`);
  const ids = await ingestTeams(db, "cito", [team]);
  const { players } = await ingestRoster(db, "cito", team.id, team.roster ?? []);
  await db.update(schema.teams).set({ rosterSyncedAt: new Date() }).where(eq(schema.teams.id, ids.get(team.id)!));
  await ingestParticipants(db, "cito", tournamentId, [{ teamId: team.id, teamName: team.name, seed: null, placement: null, status: "added" }]);
  return { team: team.name, players };
}
