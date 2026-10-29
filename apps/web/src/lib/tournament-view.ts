import "server-only";
import { type Db, schema, type Tournament } from "@cs-vv-fantasy/db";
import type { RoleId } from "@cs-vv-fantasy/scoring";
import { and, asc, eq, inArray } from "drizzle-orm";
import { loadScoringData, picksForStage, playerStagePoints, playerTotals } from "@/jobs/score";
import { loadGame } from "./fantasy";

export type ViewPlayer = {
  id: string;
  slug: string;
  nickname: string;
  countryCode: string | null;
  rating: number | null;
  citoRole: string | null;
  teamId: string;
  teamTag: string;
  teamSlug: string;
  price: number | null;
  points: number;
  maps: number;
  myRole: RoleId | "none" | null;
};

export type ViewTeam = {
  id: string;
  slug: string;
  name: string;
  tag: string;
  countryName: string | null;
  vrsRanking: number | null;
  worldRanking: number | null;
  players: ViewPlayer[];
};

export type ViewMatch = {
  id: string;
  stageName: string | null;
  startsAt: Date | null;
  bestOf: number | null;
  status: string;
  team1: { id: string; name: string; tag: string; slug: string } | null;
  team2: { id: string; name: string; tag: string; slug: string } | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerTeamId: string | null;
  myPlayers: number;
};

/** Everything the tournament page shows: teams with players, points, the user's picks and the matches. */
export async function loadTournamentView(db: Db, tournament: Tournament, userId: string | null, now = new Date()) {
  const [game, teamRows, data, matchRows] = await Promise.all([
    tournament.fantasyStatus === "none" ? null : loadGame(db, tournament, userId, now),
    db
      .select({ team: schema.teams })
      .from(schema.tournamentTeams)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.tournamentTeams.teamId))
      .where(eq(schema.tournamentTeams.tournamentId, tournament.id)),
    loadScoringData(db, tournament.id),
    db.select().from(schema.matches).where(eq(schema.matches.tournamentId, tournament.id)).orderBy(asc(schema.matches.startsAt)),
  ]);
  const teamIds = teamRows.map((r) => r.team.id);
  const [members, pool] = await Promise.all([
    teamIds.length
      ? db
          .select({ teamId: schema.teamPlayers.teamId, role: schema.teamPlayers.role, player: schema.players })
          .from(schema.teamPlayers)
          .innerJoin(schema.players, eq(schema.players.id, schema.teamPlayers.playerId))
          .where(and(inArray(schema.teamPlayers.teamId, teamIds), eq(schema.teamPlayers.isActive, true)))
      : [],
    db.select().from(schema.poolPlayers).where(eq(schema.poolPlayers.tournamentId, tournament.id)),
  ]);

  // The user's picks that count now: the open stage's picks, else the stage being played.
  const stage = game ? (game.editableStage ?? game.playingStage ?? game.stages[0] ?? null) : null;
  const myPicks = game?.mine && stage ? picksForStage(game.stages, game.mine.picks, stage) : [];
  const myRole = new Map(myPicks.map((p) => [p.playerId, ((p.role as RoleId | null) ?? "none") as RoleId | "none"]));

  const totals = playerTotals(data);
  const price = new Map(pool.map((p) => [p.playerId, p.isAvailable ? p.price : null]));
  const teamTag = (t: (typeof teamRows)[number]["team"]) => t.tag ?? t.name;

  const teams: ViewTeam[] = teamRows
    .map(({ team }) => ({
      id: team.id,
      slug: team.slug,
      name: team.name,
      tag: teamTag(team),
      countryName: team.countryName,
      vrsRanking: team.vrsRanking,
      worldRanking: team.worldRanking,
      players: members
        .filter((m) => m.teamId === team.id)
        .map((m) => ({
          id: m.player.id,
          slug: m.player.slug,
          nickname: m.player.nickname,
          countryCode: m.player.countryCode,
          rating: m.player.rating,
          citoRole: m.role,
          teamId: team.id,
          teamTag: teamTag(team),
          teamSlug: team.slug,
          price: price.get(m.player.id) ?? null,
          points: totals.get(m.player.id)?.points ?? 0,
          maps: totals.get(m.player.id)?.maps ?? 0,
          myRole: myRole.get(m.player.id) ?? null,
        }))
        .sort((a, b) => (b.price ?? 0) - (a.price ?? 0)),
    }))
    .sort((a, b) => (a.vrsRanking ?? 999) - (b.vrsRanking ?? 999) || a.name.localeCompare(b.name));

  const players = teams.flatMap((t) => t.players).sort((a, b) => b.points - a.points || (b.price ?? 0) - (a.price ?? 0));

  // Points of each of the user's picks, with role bonus, over the stages that already locked.
  const myPoints = new Map<string, number>();
  if (game?.mine) {
    for (const s of game.stages.filter((x) => x.lockAt <= now)) {
      for (const p of picksForStage(game.stages, game.mine.picks, s)) {
        const pts = playerStagePoints(data, s, p.playerId, (p.role as RoleId | null) ?? null).reduce((sum, m) => sum + m.points, 0);
        myPoints.set(p.playerId, Math.round(((myPoints.get(p.playerId) ?? 0) + pts) * 100) / 100);
      }
    }
  }

  const allTeams = new Map(
    (
      await db
        .select({ id: schema.teams.id, name: schema.teams.name, tag: schema.teams.tag, slug: schema.teams.slug })
        .from(schema.teams)
        .where(inArray(schema.teams.id, [...new Set(matchRows.flatMap((m) => [m.team1Id, m.team2Id]).filter((x): x is string => !!x)), "-"]))
    ).map((t) => [t.id, { id: t.id, name: t.name, tag: t.tag ?? t.name, slug: t.slug }]),
  );
  const myTeams = new Map<string, number>();
  for (const p of players) if (p.myRole) myTeams.set(p.teamId, (myTeams.get(p.teamId) ?? 0) + 1);
  const matches: ViewMatch[] = matchRows.map((m) => ({
    id: m.id,
    stageName: m.stageName,
    startsAt: m.startsAt,
    bestOf: m.bestOf,
    status: m.status,
    team1: m.team1Id ? (allTeams.get(m.team1Id) ?? null) : null,
    team2: m.team2Id ? (allTeams.get(m.team2Id) ?? null) : null,
    team1Score: m.team1Score,
    team2Score: m.team2Score,
    winnerTeamId: m.winnerTeamId,
    myPlayers: (m.team1Id ? (myTeams.get(m.team1Id) ?? 0) : 0) + (m.team2Id ? (myTeams.get(m.team2Id) ?? 0) : 0),
  }));

  const myTeam = game?.mine
    ? {
        name: game.mine.team.name,
        total: game.mine.total,
        picks: myPicks.map((p) => {
          const player = players.find((x) => x.id === p.playerId);
          return {
            playerId: p.playerId,
            slug: player?.slug ?? "",
            nickname: player?.nickname ?? "?",
            teamTag: player?.teamTag ?? "",
            role: ((p.role as RoleId | null) ?? "none") as RoleId | "none",
            price: p.priceAtPick,
            points: myPoints.get(p.playerId) ?? 0,
          };
        }),
      }
    : null;

  return { game, teams, players, matches, myTeam, editable: !!game?.editableStage };
}
