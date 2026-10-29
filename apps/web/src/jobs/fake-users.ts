// Fake fantasy players (users) with valid random teams, for testing leaderboards.
// Fake users have no password, so nobody can sign in as them. Production data is reset before launch.

import { type Db, schema, type Tournament } from "@cs-vv-fantasy/db";
import { enabledRoles } from "@cs-vv-fantasy/scoring";
import { and, eq, like } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { rng } from "./fake-data";
import { getGameConfig, getStages, openStage } from "./game";
import { recomputeTournamentScores } from "./score";

export const FAKE_EMAIL_DOMAIN = "fake.cs-vv-fantasy.test";

const FIRST = ["night", "frost", "ace", "rush", "clutch", "eco", "flick", "smoke", "peek", "molly", "pistol", "spray", "lurk", "boost", "nade", "wallbang"];
const SECOND = ["owl", "king", "hunter", "lord", "fox", "wolf", "ninja", "boss", "wizard", "shark", "tiger", "ghost", "viper", "rider", "smith", "fan"];
const TEAM_WORDS = ["Eco Kings", "Smoke Criminals", "Wide Peekers", "Flash Bang", "No Scope", "Force Buy", "Rush B", "Last Round", "Bomb Site", "Clutch City"];

export async function addFakeFantasyTeams(db: Db, tournament: Tournament, count: number) {
  const { config } = await getGameConfig(db, tournament.id);
  const stages = await getStages(db, tournament.id);
  const stage = openStage(stages, new Date()) ?? stages[0];
  if (!stage) throw new Error("The tournament has no fantasy stage. Open the fantasy game first.");
  const pool = await db
    .select()
    .from(schema.poolPlayers)
    .where(and(eq(schema.poolPlayers.tournamentId, tournament.id), eq(schema.poolPlayers.isAvailable, true)));
  if (pool.length < config.roster.size) throw new Error("The player pool is too small. Build the pool first.");
  const roles = enabledRoles(config);

  const existing = await db.select().from(schema.user).where(like(schema.user.email, `%@${FAKE_EMAIL_DOMAIN}`));
  const users = [...existing];
  const rand = rng(`users:${tournament.id}`);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const newUsers: BatchItem<"sqlite">[] = [];
  for (let n = existing.length + 1; users.length < count; n++) {
    const user = {
      id: crypto.randomUUID(),
      name: `${pick(FIRST)}_${pick(SECOND)}${n}`,
      email: `fan${n}@${FAKE_EMAIL_DOMAIN}`,
      emailVerified: false,
      role: "user",
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.push(user);
    newUsers.push(db.insert(schema.user).values(user).onConflictDoNothing());
  }

  const withTeam = new Set(
    (await db.select({ userId: schema.fantasyTeams.userId }).from(schema.fantasyTeams).where(eq(schema.fantasyTeams.tournamentId, tournament.id))).map(
      (r) => r.userId,
    ),
  );
  const statements: BatchItem<"sqlite">[] = [...newUsers];
  let created = 0;
  for (const user of users.slice(0, count)) {
    if (withTeam.has(user.id)) continue;
    // Random valid roster: budget, max players per real team, unique roles.
    let picks: typeof pool = [];
    for (let attempt = 0; attempt < 200 && picks.length < config.roster.size; attempt++) {
      picks = [];
      let budget = config.roster.budget;
      for (const p of [...pool].sort(() => rand() - 0.5)) {
        if (picks.length === config.roster.size) break;
        const sameTeam = picks.filter((x) => x.teamId === p.teamId).length;
        const slotsLeft = config.roster.size - picks.length - 1;
        if (sameTeam >= config.roster.maxPerTeam || p.price > budget - slotsLeft * config.pricing.minPrice) continue;
        picks.push(p);
        budget -= p.price;
      }
    }
    if (picks.length < config.roster.size) continue;
    const shuffledRoles = [...roles].sort(() => rand() - 0.5);
    const teamId = crypto.randomUUID();
    statements.push(
      db.insert(schema.fantasyTeams).values({ id: teamId, userId: user.id, tournamentId: tournament.id, name: `${pick(TEAM_WORDS)} ${Math.floor(rand() * 90) + 10}` }),
      ...picks.map((p, i) =>
        db.insert(schema.fantasyPicks).values({
          fantasyTeamId: teamId,
          stageId: stage.id,
          playerId: p.playerId,
          role: roles.length ? (config.roster.uniqueRoles ? (shuffledRoles[i] ?? null) : pick(roles)) : null,
          priceAtPick: p.price,
        }),
      ),
    );
    created++;
  }
  for (let i = 0; i < statements.length; i += 50) {
    const [first, ...rest] = statements.slice(i, i + 50);
    if (first) await db.batch([first, ...rest]);
  }
  await recomputeTournamentScores(db, tournament.id);
  return { users: Math.min(count, users.length), teams: created };
}
