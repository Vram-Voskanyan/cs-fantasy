// Writes provider data (Cito-shaped) into our tables. The real Cito sync and the fake data
// generator both go through these functions, so fake data has exactly the provider's shape.

import { type Db, schema } from "@cs-vv-fantasy/db";
import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { CitoGame, CitoMatch, CitoParticipant, CitoRosterEntry, CitoTeam } from "./cito";

export type Provider = "cito" | "fake";
type Entity = "team" | "player" | "match" | "map" | "tournament";

const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);

async function runBatch(db: Db, statements: BatchItem<"sqlite">[]) {
  // D1 batches are transactions; keep them moderate in size.
  for (let i = 0; i < statements.length; i += 50) {
    const chunk = statements.slice(i, i + 50);
    const [first, ...rest] = chunk;
    if (first) await db.batch([first, ...rest]);
  }
}

/** Maps provider IDs to internal IDs, creating new internal IDs for unknown ones. */
export async function resolveIds(db: Db, provider: Provider, entity: Entity, providerIds: string[]) {
  const unique = [...new Set(providerIds)];
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 90) {
    const rows = await db
      .select({ providerId: schema.externalIds.providerId, internalId: schema.externalIds.internalId })
      .from(schema.externalIds)
      .where(
        and(
          eq(schema.externalIds.provider, provider),
          eq(schema.externalIds.entityType, entity),
          inArray(schema.externalIds.providerId, unique.slice(i, i + 90)),
        ),
      );
    for (const r of rows) map.set(r.providerId, r.internalId);
  }
  const created = unique.filter((id) => !map.has(id));
  const inserts = created.map((providerId) => {
    const internalId = crypto.randomUUID();
    map.set(providerId, internalId);
    return db.insert(schema.externalIds).values({ provider, entityType: entity, providerId, internalId });
  });
  await runBatch(db, inserts);
  return { map, created: new Set(created) };
}

// Slugs are unique in our tables; a fake team may share a name with a real one.
const slugFor = (provider: Provider, slug: string) => (provider === "fake" ? `fake-${slug}` : slug);

export async function ingestTeams(db: Db, provider: Provider, teams: CitoTeam[]) {
  const { map } = await resolveIds(
    db,
    provider,
    "team",
    teams.map((t) => t.id),
  );
  const syncedAt = new Date();
  const statements = teams.map((t) => {
    const values = {
      slug: slugFor(provider, t.slug),
      name: t.name,
      tag: t.teamTag,
      countryName: t.countryName,
      countryCode: t.countryCode,
      region: t.region,
      worldRanking: t.worldRanking,
      vrsRanking: t.vrsRanking,
      logoUrl: t.logoUrl,
      syncedAt,
    };
    return db
      .insert(schema.teams)
      .values({ id: map.get(t.id)!, ...values })
      .onConflictDoUpdate({ target: schema.teams.id, set: values });
  });
  await runBatch(db, statements);
  return map;
}

export async function ingestRoster(db: Db, provider: Provider, teamProviderId: string, roster: CitoRosterEntry[]) {
  const teamIds = await resolveIds(db, provider, "team", [teamProviderId]);
  const teamId = teamIds.map.get(teamProviderId)!;
  // Coaches are not players in the fantasy game.
  const entries = roster.filter((r) => r.role?.toLowerCase() !== "coach");
  const { map } = await resolveIds(
    db,
    provider,
    "player",
    entries.map((r) => r.playerId),
  );
  const syncedAt = new Date();
  const statements: BatchItem<"sqlite">[] = [];
  for (const r of entries) {
    const playerId = map.get(r.playerId)!;
    const values = {
      slug: slugFor(provider, r.playerSlug),
      nickname: r.playerNickname,
      realName: r.playerName,
      countryName: r.countryName,
      countryCode: r.countryCode,
      age: r.age,
      imageUrl: r.playerImageUrl,
      rating: r.rating,
      mapsPlayed: r.mapsPlayed,
      syncedAt,
    };
    statements.push(
      db
        .insert(schema.players)
        .values({ id: playerId, ...values })
        .onConflictDoUpdate({ target: schema.players.id, set: values }),
    );
    const membership = { role: r.role, isActive: r.isActive, fromAt: toDate(r.fromAt), toAt: toDate(r.toAt) };
    statements.push(
      db
        .insert(schema.teamPlayers)
        .values({ teamId, playerId, ...membership })
        .onConflictDoUpdate({ target: [schema.teamPlayers.teamId, schema.teamPlayers.playerId], set: membership }),
    );
  }
  await runBatch(db, statements);
  return { teamId, players: entries.length };
}

export async function ingestParticipants(db: Db, provider: Provider, tournamentId: string, participants: CitoParticipant[]) {
  const { map } = await resolveIds(
    db,
    provider,
    "team",
    participants.map((p) => p.teamId),
  );
  const statements = participants.map((p) => {
    const values = { seed: p.seed, placement: p.placement, status: p.status };
    return db
      .insert(schema.tournamentTeams)
      .values({ tournamentId, teamId: map.get(p.teamId)!, ...values })
      .onConflictDoUpdate({ target: [schema.tournamentTeams.tournamentId, schema.tournamentTeams.teamId], set: values });
  });
  await runBatch(db, statements);
}

export async function ingestMatches(db: Db, provider: Provider, tournamentId: string, matches: CitoMatch[]) {
  const embeddedTeams = new Map<string, CitoTeam>();
  for (const m of matches) {
    if (m.team1) embeddedTeams.set(m.team1.id, m.team1);
    if (m.team2) embeddedTeams.set(m.team2.id, m.team2);
  }
  const teamIds = await ingestTeams(db, provider, [...embeddedTeams.values()]);
  const { map: matchIds } = await resolveIds(
    db,
    provider,
    "match",
    matches.map((m) => m.id),
  );
  const allMaps = matches.flatMap((m) => m.maps ?? []);
  const { map: mapIds } = await resolveIds(
    db,
    provider,
    "map",
    allMaps.map((m) => m.id),
  );
  const team = (id: string | null) => (id ? (teamIds.get(id) ?? null) : null);

  const syncedAt = new Date();
  const statements: BatchItem<"sqlite">[] = [];
  for (const m of matches) {
    const matchId = matchIds.get(m.id)!;
    const values = {
      tournamentId,
      stageName: m.stageName,
      startsAt: toDate(m.startsAt),
      endsAt: toDate(m.endsAt),
      bestOf: m.bestOf,
      status: m.status,
      team1Id: team(m.team1Id),
      team2Id: team(m.team2Id),
      team1Score: m.team1Score,
      team2Score: m.team2Score,
      winnerTeamId: team(m.winnerTeamId),
      isForfeit: m.isForfeit,
      syncedAt,
    };
    statements.push(
      db
        .insert(schema.matches)
        .values({ id: matchId, ...values })
        .onConflictDoUpdate({ target: schema.matches.id, set: values }),
    );
    for (const mp of m.maps ?? []) {
      const mapValues = {
        matchId,
        mapNumber: mp.mapNumber,
        mapName: mp.mapName,
        status: mp.status,
        team1Score: mp.team1Score,
        team2Score: mp.team2Score,
        winnerTeamId: team(mp.winnerTeamId),
        durationRounds: mp.durationRounds,
        pickTeamId: team(mp.pickTeamId),
        isForfeit: mp.isForfeit,
        syncedAt,
      };
      statements.push(
        db
          .insert(schema.matchMaps)
          .values({ id: mapIds.get(mp.id)!, ...mapValues })
          .onConflictDoUpdate({ target: schema.matchMaps.id, set: mapValues }),
      );
    }
  }
  await runBatch(db, statements);
  return { matches: matches.length, maps: allMaps.length };
}

/** Stores map results and per-player map stats for one match. Returns internal map IDs. */
export async function ingestGames(db: Db, provider: Provider, matchProviderId: string, games: CitoGame[]) {
  const { map: matchIds } = await resolveIds(db, provider, "match", [matchProviderId]);
  const matchId = matchIds.get(matchProviderId)!;
  const { map: mapIds } = await resolveIds(
    db,
    provider,
    "map",
    games.map((g) => g.id),
  );
  const teamProviderIds = games.flatMap((g) => [g.winnerTeamId, ...g.playerStats.map((s) => s.teamId)]).filter((x): x is string => !!x);
  const { map: teamIds } = await resolveIds(db, provider, "team", teamProviderIds);
  const stats = games.flatMap((g) => g.playerStats);
  const { map: playerIds, created: newPlayers } = await resolveIds(
    db,
    provider,
    "player",
    stats.map((s) => s.playerId),
  );
  const team = (id: string | null) => (id ? (teamIds.get(id) ?? null) : null);

  const syncedAt = new Date();
  const statements: BatchItem<"sqlite">[] = [];
  // Stand-ins that are not on a synced roster still need a player row.
  for (const s of stats) {
    if (!newPlayers.has(s.playerId)) continue;
    newPlayers.delete(s.playerId);
    statements.push(
      db
        .insert(schema.players)
        .values({ id: playerIds.get(s.playerId)!, slug: slugFor(provider, s.playerId), nickname: s.playerName, syncedAt })
        .onConflictDoNothing(),
    );
  }
  for (const g of games) {
    const mapId = mapIds.get(g.id)!;
    const mapValues = {
      matchId,
      mapNumber: g.mapNumber,
      mapName: g.map,
      status: g.status,
      team1Score: g.score?.team1 ?? null,
      team2Score: g.score?.team2 ?? null,
      winnerTeamId: team(g.winnerTeamId),
      durationRounds: g.durationRounds,
      pickTeamId: team(g.pickTeamId),
      isForfeit: g.isForfeit,
      syncedAt,
    };
    statements.push(
      db
        .insert(schema.matchMaps)
        .values({ id: mapId, ...mapValues })
        .onConflictDoUpdate({ target: schema.matchMaps.id, set: mapValues }),
    );
    for (const s of g.playerStats) {
      const values = {
        teamId: team(s.teamId),
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists,
        plusMinus: s.plusMinus,
        adr: s.adr,
        kast: s.kast,
        rating: s.rating,
        headshots: s.headshots,
        headshotPercent: s.headshotPercent,
        openingKills: s.openingKills,
        openingDeaths: s.openingDeaths,
        syncedAt,
      };
      statements.push(
        db
          .insert(schema.playerMapStats)
          .values({ mapId, playerId: playerIds.get(s.playerId)!, ...values })
          .onConflictDoUpdate({ target: [schema.playerMapStats.mapId, schema.playerMapStats.playerId], set: values }),
      );
    }
  }
  statements.push(db.update(schema.matches).set({ statsSyncedAt: syncedAt }).where(eq(schema.matches.id, matchId)));
  await runBatch(db, statements);
  return { matchId, mapIds: games.map((g) => mapIds.get(g.id)!) };
}
