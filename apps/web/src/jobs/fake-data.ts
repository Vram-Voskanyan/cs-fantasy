// Fake tournament data in the exact Cito response shape, for testing without using API calls.
// It goes through the same ingest functions as real data. Production data is reset before launch.
// Generation is deterministic per tournament, so a match can be simulated later from its ID.

import { createDb, type Db, schema, type Tournament } from "@cs-vv-fantasy/db";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { CitoGame, CitoMatch, CitoParticipant, CitoPlayerStat, CitoRosterEntry, CitoTeam } from "./cito";
import { ingestGames, ingestMatches, ingestParticipants, ingestRoster, ingestTeams, type Provider, resolveIds } from "./ingest";
import { scoreMatch } from "./score";

export function rng(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEAM_NAMES = [
  "Arcadia", "Blackout", "Cobalt", "Driftline", "Ember Six", "Frostbyte", "Granite", "Halcyon",
  "Ironclad", "Jetstream", "Kodiak", "Lumen", "Monolith", "Nightjar", "Onyx", "Paragon",
];
const SYLLABLES = ["ka", "ro", "vex", "lu", "zen", "dra", "mi", "tor", "ix", "sa", "no", "fy", "qu", "el", "bo", "rin"];
const COUNTRIES: [string, string][] = [
  ["France", "FR"], ["Denmark", "DK"], ["Brazil", "BR"], ["Poland", "PL"], ["Sweden", "SE"], ["Ukraine", "UA"],
  ["Finland", "FI"], ["United States", "US"], ["Latvia", "LV"], ["Israel", "IL"], ["Mongolia", "MN"], ["Armenia", "AM"],
];
const ROLES = ["AWPer", "Rifler", "Rifler", "Entry", "IGL"];
const GROUP_STAGE = "Group stage";
const MAPS = ["Ancient", "Anubis", "Dust2", "Inferno", "Mirage", "Nuke", "Train"];

type FakeTournament = {
  teams: CitoTeam[];
  participants: CitoParticipant[];
  rosters: Map<string, CitoRosterEntry[]>;
  matches: CitoMatch[];
};

export function generateFakeTournament(t: Tournament): FakeTournament {
  const rand = rng(`fake:${t.id}`);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const prefix = `fake-${t.id.slice(0, 8)}`;
  const size = Math.max(8, Math.min(16, t.teamCount ?? 8)) >= 16 ? 16 : 8;

  const ranks = [...Array(60).keys()].map((i) => i + 1).sort(() => rand() - 0.5);
  const teams: CitoTeam[] = TEAM_NAMES.slice(0, size).map((name, i) => {
    const [countryName, countryCode] = pick(COUNTRIES);
    return {
      id: `${prefix}-team-${i + 1}`,
      name,
      slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${t.id.slice(0, 4)}`,
      teamTag: name.replace(/\s+/g, "").slice(0, 4).toUpperCase(),
      countryName,
      countryCode,
      region: "Europe",
      worldRanking: ranks[i],
      vrsRanking: ranks[i],
      logoUrl: null,
    };
  });

  const rosters = new Map<string, CitoRosterEntry[]>();
  const usedNicks = new Set<string>();
  const uniqueNick = () => {
    let nick = "";
    do nick = pick(SYLLABLES) + pick(SYLLABLES) + (rand() < 0.3 ? pick(SYLLABLES) : "");
    while (usedNicks.has(nick));
    usedNicks.add(nick);
    return nick;
  };
  for (const team of teams) {
    rosters.set(
      team.id,
      ROLES.map((role, j) => {
        const nick = uniqueNick();
        const [countryName, countryCode] = rand() < 0.7 ? [team.countryName, team.countryCode] : pick(COUNTRIES);
        return {
          teamId: team.id,
          playerId: `${team.id}-player-${j + 1}`,
          playerNickname: nick,
          playerName: null,
          playerImageUrl: null,
          playerSlug: `${nick}-${t.id.slice(0, 4)}${teams.indexOf(team)}${j}`,
          countryName,
          countryCode,
          age: 18 + Math.floor(rand() * 12),
          rating: Math.round((0.85 + rand() * 0.45) * 100) / 100,
          mapsPlayed: 50 + Math.floor(rand() * 600),
          role,
          fromAt: null,
          toAt: null,
          isActive: true,
        };
      }),
    );
  }

  const participants: CitoParticipant[] = teams.map((team, i) => ({
    teamId: team.id,
    teamName: team.name,
    seed: i + 1,
    placement: null,
    status: "registered",
  }));

  return { teams, participants, rosters, matches: generateSchedule(t, teams) };
}

/** The teams a fake schedule uses: the best 16 (or 8) by VRS rank, then by ID. */
export function scheduleTeams(allTeams: CitoTeam[]) {
  const size = allTeams.length >= 16 ? 16 : 8;
  return [...allTeams].sort((a, b) => (a.vrsRanking ?? 999) - (b.vrsRanking ?? 999) || a.id.localeCompare(b.id)).slice(0, size);
}

/**
 * Fake match schedule for the given teams (fake or real): 3 group rounds, then quarter-finals (16 teams)
 * or semi-finals (8), and a BO5 final. Deterministic for the same tournament and team list.
 */
export function generateSchedule(t: Tournament, allTeams: CitoTeam[]): CitoMatch[] {
  const rand = rng(`schedule:${t.id}`);
  const prefix = `fake-${t.id.slice(0, 8)}`;
  const size = allTeams.length >= 16 ? 16 : 8;
  const teams = scheduleTeams(allTeams);
  const start = t.startsAt ? t.startsAt.getTime() : Date.now() + 2 * 86_400_000;
  const hour = 3_600_000;
  const matches: CitoMatch[] = [];
  // Playoff teams are TBD (null) until the previous round is played, as in Cito.
  const addMatch = (stageName: string, a: CitoTeam | null, b: CitoTeam | null, startsAt: number, bestOf: number) => {
    matches.push({
      id: `${prefix}-match-${matches.length + 1}`,
      eventId: t.id,
      stageName,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: null,
      bestOf,
      status: "upcoming",
      team1Id: a?.id ?? null,
      team2Id: b?.id ?? null,
      team1Score: null,
      team2Score: null,
      winnerTeamId: null,
      isForfeit: false,
      team1: a,
      team2: b,
      maps: [],
    });
  };
  for (let round = 0; round < 3; round++) {
    const order = [...teams].sort(() => rand() - 0.5);
    for (let i = 0; i < order.length; i += 2) {
      addMatch(GROUP_STAGE, order[i], order[i + 1], start + round * 24 * hour + (i / 2) * 2 * hour, 3);
    }
  }
  const playoffStart = start + 4 * 24 * hour;
  if (size === 16) {
    for (let i = 0; i < 4; i++) addMatch("Quarter-finals", null, null, playoffStart + i * 3 * hour, 3);
  }
  for (let i = 0; i < 2; i++) addMatch("Semi-finals", null, null, playoffStart + (size === 16 ? 24 : 0) * hour + i * 3 * hour, 3);
  addMatch("Grand final", null, null, playoffStart + (size === 16 ? 48 : 24) * hour, 5);
  return matches;
}

// Cito Rating 1.0 per map (from the API docs): 0.30*KPR/0.683 + 0.25*(1-DPR)/0.305 + 0.25*ADR/74.1 + 0.15*KAST/0.716 + 0.05*APR/0.223
function citoRating(kills: number, deaths: number, assists: number, adr: number, kast: number, rounds: number) {
  const value =
    (0.3 * (kills / rounds)) / 0.683 + (0.25 * (1 - deaths / rounds)) / 0.305 + (0.25 * adr) / 74.1 + (0.15 * kast) / 0.716 + (0.05 * (assists / rounds)) / 0.223;
  return Math.round(value * 100) / 100;
}

function simulateGames(match: CitoMatch, rosters: Map<string, CitoRosterEntry[]>): { games: CitoGame[]; winner: string; score: [number, number] } {
  const rand = rng(`sim:${match.id}`);
  const team1 = match.team1!;
  const team2 = match.team2!;
  const needed = Math.ceil((match.bestOf ?? 1) / 2);
  const strength1 = 1 / (team1.vrsRanking ?? 30);
  const strength2 = 1 / (team2.vrsRanking ?? 30);
  const p1 = 0.35 + 0.3 * (strength1 / (strength1 + strength2));
  const maps = [...MAPS].sort(() => rand() - 0.5);
  const games: CitoGame[] = [];
  let wins1 = 0;
  let wins2 = 0;
  while (wins1 < needed && wins2 < needed) {
    const team1Won = rand() < p1;
    const loserRounds = Math.floor(rand() * 12);
    const overtime = loserRounds === 11 && rand() < 0.5;
    const winnerRounds = overtime ? 16 : 13;
    const rounds = winnerRounds + (overtime ? 14 : loserRounds);
    const [r1, r2] = team1Won ? [winnerRounds, rounds - winnerRounds] : [rounds - winnerRounds, winnerRounds];
    if (team1Won) wins1++;
    else wins2++;

    const playerStats: CitoPlayerStat[] = [];
    let openingLeft = rounds;
    for (const [team, won] of [
      [team1, team1Won],
      [team2, !team1Won],
    ] as const) {
      for (const p of rosters.get(team.id) ?? []) {
        // Typical pro numbers: about 0.7 kills and 0.68 deaths per round, shifted by rating and map result.
        const skill = (1 + ((p.rating ?? 1) - 1) * 0.8) * (won ? 1.08 : 0.92);
        const kills = Math.max(1, Math.round(rounds * (0.5 + rand() * 0.4) * skill));
        const deaths = Math.max(3, Math.min(rounds, Math.round((rounds * (0.55 + rand() * 0.3)) / skill)));
        const assists = Math.round(rand() * rounds * 0.25);
        const adr = Math.round((kills / rounds) * 105 + rand() * 20);
        const kast = Math.round(Math.min(0.95, 0.5 + rand() * 0.25 + (won ? 0.1 : 0)) * 1000) / 1000;
        const headshots = Math.round(kills * (0.3 + rand() * 0.35));
        const openingKills = Math.min(openingLeft, Math.round(rand() * rounds * 0.14 * skill));
        openingLeft -= openingKills;
        playerStats.push({
          playerId: p.playerId,
          playerName: p.playerNickname,
          teamId: team.id,
          kills,
          deaths,
          assists,
          plusMinus: kills - deaths,
          adr,
          kast,
          rating: citoRating(kills, deaths, assists, adr, kast, rounds),
          headshots,
          headshotPercent: Math.round((headshots / kills) * 1000) / 1000,
          openingKills,
          openingDeaths: Math.round(rand() * rounds * 0.12),
        });
      }
    }
    games.push({
      id: `${match.id}-map-${games.length + 1}`,
      matchId: match.id,
      mapNumber: games.length + 1,
      map: maps[games.length % maps.length],
      winnerTeamId: team1Won ? team1.id : team2.id,
      score: { team1: r1, team2: r2 },
      durationRounds: rounds,
      status: "completed",
      isForfeit: false,
      pickTeamId: games.length % 2 === 0 ? team1.id : team2.id,
      playerStats,
    });
  }
  return { games, winner: wins1 > wins2 ? team1.id : team2.id, score: [wins1, wins2] };
}

type FakeContext = {
  // Provider of the team and player IDs: "cito" when real teams are loaded, else "fake".
  provider: Provider;
  teams: CitoTeam[];
  rosters: Map<string, CitoRosterEntry[]>;
  matches: CitoMatch[];
};

/** The tournament's real Cito teams and active rosters, in Cito shape, or null if none are loaded. */
async function loadRealTeams(db: Db, t: Tournament) {
  const rows = await db
    .select({ team: schema.teams, providerId: schema.externalIds.providerId })
    .from(schema.tournamentTeams)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.tournamentTeams.teamId))
    .innerJoin(
      schema.externalIds,
      and(eq(schema.externalIds.provider, "cito"), eq(schema.externalIds.entityType, "team"), eq(schema.externalIds.internalId, schema.teams.id)),
    )
    .where(eq(schema.tournamentTeams.tournamentId, t.id))
    .orderBy(asc(schema.externalIds.providerId));
  if (rows.length < 2) return null;
  const teams: CitoTeam[] = rows.map(({ team, providerId }) => ({
    id: providerId,
    name: team.name,
    slug: team.slug,
    teamTag: team.tag,
    countryName: team.countryName,
    countryCode: team.countryCode,
    region: team.region,
    worldRanking: team.worldRanking,
    vrsRanking: team.vrsRanking,
    logoUrl: team.logoUrl,
  }));
  const providerByTeam = new Map(rows.map((r) => [r.team.id, r.providerId]));
  const members = await db
    .select({ teamId: schema.teamPlayers.teamId, role: schema.teamPlayers.role, player: schema.players, providerId: schema.externalIds.providerId })
    .from(schema.teamPlayers)
    .innerJoin(schema.players, eq(schema.players.id, schema.teamPlayers.playerId))
    .innerJoin(
      schema.externalIds,
      and(eq(schema.externalIds.provider, "cito"), eq(schema.externalIds.entityType, "player"), eq(schema.externalIds.internalId, schema.players.id)),
    )
    .where(and(inArray(schema.teamPlayers.teamId, [...providerByTeam.keys()]), eq(schema.teamPlayers.isActive, true)))
    .orderBy(asc(schema.externalIds.providerId));
  const rosters = new Map<string, CitoRosterEntry[]>();
  for (const m of members) {
    const teamProviderId = providerByTeam.get(m.teamId)!;
    const list = rosters.get(teamProviderId) ?? [];
    list.push({
      teamId: teamProviderId,
      playerId: m.providerId,
      playerNickname: m.player.nickname,
      playerName: m.player.realName,
      playerImageUrl: m.player.imageUrl,
      playerSlug: m.player.slug,
      countryName: m.player.countryName,
      countryCode: m.player.countryCode,
      age: m.player.age,
      rating: m.player.rating,
      mapsPlayed: m.player.mapsPlayed,
      role: m.role,
      fromAt: null,
      toAt: null,
      isActive: true,
    });
    rosters.set(teamProviderId, list);
  }
  return { teams, rosters };
}

async function fakeContext(db: Db, t: Tournament): Promise<FakeContext> {
  const real = await loadRealTeams(db, t);
  if (real) return { provider: "cito", teams: real.teams, rosters: real.rosters, matches: generateSchedule(t, real.teams) };
  const fake = generateFakeTournament(t);
  return { provider: "fake", teams: fake.teams, rosters: fake.rosters, matches: fake.matches };
}

/**
 * Fake test data. With real Cito teams loaded: keeps the real teams and players and replaces the matches
 * with a fake schedule. Without: creates fake teams, rosters and schedule.
 */
export async function fillFakeTournament(db: Db, tournament: Tournament) {
  const real = await loadRealTeams(db, tournament);
  if (real) {
    const matches = generateSchedule(tournament, real.teams);
    // Teams outside the fake schedule leave the tournament (and its player pool).
    const playing = new Set(scheduleTeams(real.teams).map((t) => t.id));
    const { map: teamIds } = await resolveIds(
      db,
      "cito",
      "team",
      real.teams.map((t) => t.id),
    );
    const dropped = real.teams.filter((t) => !playing.has(t.id)).map((t) => teamIds.get(t.id)!);
    if (dropped.length > 0) {
      await db.batch([
        db.delete(schema.poolPlayers).where(and(eq(schema.poolPlayers.tournamentId, tournament.id), inArray(schema.poolPlayers.teamId, dropped))),
        db.delete(schema.tournamentTeams).where(and(eq(schema.tournamentTeams.tournamentId, tournament.id), inArray(schema.tournamentTeams.teamId, dropped))),
      ]);
    }
    await db.delete(schema.matches).where(eq(schema.matches.tournamentId, tournament.id));
    await ingestMatches(db, "cito", tournament.id, matches);
    await db.update(schema.tournaments).set({ dataSource: "fake" }).where(eq(schema.tournaments.id, tournament.id));
    const players = [...playing].reduce((n, id) => n + (real.rosters.get(id)?.length ?? 0), 0);
    return { teams: playing.size, players, matches: matches.length, realTeams: true };
  }
  const fake = generateFakeTournament(tournament);
  await ingestTeams(db, "fake", fake.teams);
  for (const [teamId, roster] of fake.rosters) await ingestRoster(db, "fake", teamId, roster);
  await ingestParticipants(db, "fake", tournament.id, fake.participants);
  await ingestMatches(db, "fake", tournament.id, fake.matches);
  await db.update(schema.tournaments).set({ dataSource: "fake" }).where(eq(schema.tournaments.id, tournament.id));
  return { teams: fake.teams.length, players: fake.teams.length * 5, matches: fake.matches.length, realTeams: false };
}

/**
 * Fills a TBD playoff match: the first playoff round is seeded from group standings (wins, map difference,
 * VRS rank), later rounds take the winners of the two matches that feed them.
 */
async function resolvePlayoffTeams(db: Db, ctx: FakeContext, match: CitoMatch): Promise<CitoMatch | null> {
  const playoffStages = [...new Set(ctx.matches.map((m) => m.stageName))].filter((n) => n !== GROUP_STAGE);
  const roundIndex = playoffStages.indexOf(match.stageName);
  const round = ctx.matches.filter((m) => m.stageName === match.stageName);
  const position = round.findIndex((m) => m.id === match.id);
  const { map: teamIds } = await resolveIds(
    db,
    ctx.provider,
    "team",
    ctx.teams.map((t) => t.id),
  );
  const providerTeam = new Map([...teamIds].map(([providerId, internalId]) => [internalId, providerId]));
  const teamByProvider = new Map(ctx.teams.map((t) => [t.id, t]));

  async function matchRows(list: CitoMatch[]) {
    const { map } = await resolveIds(
      db,
      ctx.provider,
      "match",
      list.map((m) => m.id),
    );
    const rows = await db.select().from(schema.matches).where(inArray(schema.matches.id, [...map.values()]));
    return list.map((m) => rows.find((r) => r.id === map.get(m.id)));
  }

  let pair: [string, string];
  if (roundIndex === 0) {
    const group = ctx.matches.filter((m) => m.stageName === GROUP_STAGE);
    const table = new Map<string, { wins: number; diff: number }>();
    for (const m of group) for (const id of [m.team1Id, m.team2Id]) if (id) table.set(id, { wins: 0, diff: 0 });
    for (const row of await matchRows(group)) {
      if (!row || row.status !== "completed" || !row.winnerTeamId || !row.team1Id || !row.team2Id) continue;
      const t1 = table.get(providerTeam.get(row.team1Id)!)!;
      const t2 = table.get(providerTeam.get(row.team2Id)!)!;
      const d = (row.team1Score ?? 0) - (row.team2Score ?? 0);
      t1.diff += d;
      t2.diff -= d;
      (row.winnerTeamId === row.team1Id ? t1 : t2).wins += 1;
    }
    const rank = (id: string) => teamByProvider.get(id)?.vrsRanking ?? 999;
    const ranked = [...table.entries()].sort((a, b) => b[1].wins - a[1].wins || b[1].diff - a[1].diff || rank(a[0]) - rank(b[0])).map(([id]) => id);
    // Standard seeding: 1v8, 4v5, 2v7, 3v6 (or 1v4, 2v3).
    const order = round.length === 4 ? [[0, 7], [3, 4], [1, 6], [2, 5]] : [[0, 3], [1, 2]];
    const [a, b] = order[position];
    pair = [ranked[a], ranked[b]];
  } else {
    const previous = ctx.matches.filter((m) => m.stageName === playoffStages[roundIndex - 1]);
    const rows = await matchRows([previous[position * 2], previous[position * 2 + 1]]);
    const winners = rows.map((r) => (r?.winnerTeamId ? providerTeam.get(r.winnerTeamId) : undefined));
    if (!winners[0] || !winners[1]) return null;
    pair = [winners[0], winners[1]];
  }
  const [team1, team2] = pair.map((id) => teamByProvider.get(id)!);
  return { ...match, team1Id: team1.id, team2Id: team2.id, team1, team2 };
}

/** Plays the next scheduled fake match: map results, player stats, then scoring. */
export async function simulateNextMatch(db: Db, tournament: Tournament) {
  const ctx = await fakeContext(db, tournament);
  const { map: ids } = await resolveIds(
    db,
    ctx.provider,
    "match",
    ctx.matches.map((m) => m.id),
  );
  const open = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(and(eq(schema.matches.tournamentId, tournament.id), ne(schema.matches.status, "completed"), inArray(schema.matches.id, [...ids.values()])))
    .orderBy(asc(schema.matches.startsAt))
    .limit(1);
  if (open.length === 0) return null;
  let match = ctx.matches.find((m) => ids.get(m.id) === open[0].id)!;
  if (!match.team1Id || !match.team2Id) {
    const resolved = await resolvePlayoffTeams(db, ctx, match);
    if (!resolved) return null;
    match = resolved;
  }
  const { games, winner, score } = simulateGames(match, ctx.rosters);
  const finished: CitoMatch = {
    ...match,
    status: "completed",
    endsAt: new Date().toISOString(),
    team1Score: score[0],
    team2Score: score[1],
    winnerTeamId: winner,
    maps: games.map((g) => ({
      id: g.id,
      matchId: g.matchId,
      mapNumber: g.mapNumber,
      mapName: g.map,
      status: g.status,
      team1Score: g.score?.team1 ?? null,
      team2Score: g.score?.team2 ?? null,
      winnerTeamId: g.winnerTeamId,
      durationRounds: g.durationRounds,
      pickTeamId: g.pickTeamId,
      isForfeit: g.isForfeit,
    })),
  };
  await ingestMatches(db, ctx.provider, tournament.id, [finished]);
  const result = await ingestGames(db, ctx.provider, match.id, games);
  await scoreMatch(db, result.matchId);
  await fillReadyPlayoffs(db, ctx, tournament);
  return { matchId: result.matchId, maps: games.length };
}

/** Shows playoff pairings as soon as they are known (group finished, or both feeder matches played). */
async function fillReadyPlayoffs(db: Db, ctx: FakeContext, tournament: Tournament) {
  const playoff = ctx.matches.filter((m) => m.stageName !== GROUP_STAGE);
  const { map: ids } = await resolveIds(
    db,
    ctx.provider,
    "match",
    playoff.map((m) => m.id),
  );
  const rows = await db.select().from(schema.matches).where(inArray(schema.matches.id, [...ids.values()]));
  const group = ctx.matches.filter((m) => m.stageName === GROUP_STAGE);
  const { map: groupIds } = await resolveIds(
    db,
    ctx.provider,
    "match",
    group.map((m) => m.id),
  );
  const groupRows = await db.select({ status: schema.matches.status }).from(schema.matches).where(inArray(schema.matches.id, [...groupIds.values()]));
  const groupDone = groupRows.length > 0 && groupRows.every((r) => r.status === "completed");
  const firstStage = playoff[0]?.stageName;
  for (const m of playoff) {
    const row = rows.find((r) => r.id === ids.get(m.id));
    if (!row || (row.team1Id && row.team2Id)) continue;
    if (m.stageName === firstStage && !groupDone) continue;
    const resolved = await resolvePlayoffTeams(db, ctx, m);
    if (resolved) await ingestMatches(db, ctx.provider, tournament.id, [resolved]);
  }
}

export async function getTournamentById(env: CloudflareEnv, id: string) {
  const db = createDb(env.DB);
  const [row] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, id)).limit(1);
  return { db, tournament: row ?? null };
}
