"use server";

import { schema } from "@cs-vv-fantasy/db";
import { DEFAULT_GAME_CONFIG, parseGameConfig } from "@cs-vv-fantasy/scoring";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { buildPool as buildPoolOp, setFantasyStatus as setStatus } from "@/jobs/admin-ops";
import { fillFakeTournament, getTournamentById, simulateNextMatch } from "@/jobs/fake-data";
import { getGameConfig, getStages } from "@/jobs/game";
import { recomputeTournamentScores, rescoreTournament } from "@/jobs/score";
import { syncTournamentMatches, syncTournamentStats, syncTournamentTeams } from "@/jobs/sync-tournament";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

export type ActionResult = { ok: boolean; key: string; values?: Record<string, string | number> };

const STATS_CALLS_PER_RUN = 5;

async function run(fn: () => Promise<ActionResult>, path: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    const result = await fn();
    revalidatePath(path);
    return result;
  } catch (error) {
    console.error("[admin]", error);
    return { ok: false, key: "error", values: { error: error instanceof Error ? error.message : String(error) } };
  }
}

async function env() {
  return (await getCloudflareContext({ async: true })).env;
}

const fantasyStatuses = schema.fantasyStatuses;

export async function setFantasyStatus(tournamentId: string, status: string): Promise<ActionResult> {
  return run(async () => {
    if (!(fantasyStatuses as readonly string[]).includes(status)) throw new Error("bad status");
    const { db, tournament } = await getTournamentById(await env(), tournamentId);
    if (!tournament) throw new Error("not found");
    await setStatus(db, tournament, status as (typeof fantasyStatuses)[number]);
    return { ok: true, key: "ok" };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function saveStages(tournamentId: string, stages: { id?: string; name: string; lockAt: string }[]): Promise<ActionResult> {
  return run(async () => {
    const db = await getDb();
    const existing = await getStages(db, tournamentId);
    const keep = new Set(stages.map((s) => s.id).filter(Boolean));
    const sorted = [...stages].sort((a, b) => Date.parse(a.lockAt) - Date.parse(b.lockAt));
    for (const s of existing) if (!keep.has(s.id)) await db.delete(schema.fantasyStages).where(eq(schema.fantasyStages.id, s.id));
    for (const [i, s] of sorted.entries()) {
      const lockAt = new Date(s.lockAt);
      if (Number.isNaN(lockAt.getTime()) || !s.name.trim()) throw new Error("invalid stage");
      const values = { tournamentId, order: i + 1, name: s.name.trim().slice(0, 40), lockAt };
      if (s.id && existing.some((e) => e.id === s.id)) await db.update(schema.fantasyStages).set(values).where(eq(schema.fantasyStages.id, s.id));
      else await db.insert(schema.fantasyStages).values({ id: crypto.randomUUID(), ...values });
    }
    await recomputeTournamentScores(db, tournamentId);
    return { ok: true, key: "stages" };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function loadCitoTeams(tournamentId: string): Promise<ActionResult> {
  return run(async () => {
    const r = await syncTournamentTeams(await env(), tournamentId);
    return { ok: true, key: "teams", values: { teams: r.teams, players: r.players } };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function loadCitoMatches(tournamentId: string): Promise<ActionResult> {
  return run(async () => {
    const r = await syncTournamentMatches(await env(), tournamentId);
    return { ok: true, key: "matches", values: { matches: r.matches, maps: r.maps } };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function loadCitoStats(tournamentId: string): Promise<ActionResult> {
  return run(async () => {
    const r = await syncTournamentStats(await env(), tournamentId, STATS_CALLS_PER_RUN);
    return { ok: true, key: "stats", values: { matches: r.matches, maps: r.maps } };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function fillFake(tournamentId: string): Promise<ActionResult> {
  return run(async () => {
    const { db, tournament } = await getTournamentById(await env(), tournamentId);
    if (!tournament) throw new Error("not found");
    const r = await fillFakeTournament(db, tournament);
    return { ok: true, key: "fake", values: r };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function simulateMatches(tournamentId: string, count: number): Promise<ActionResult> {
  return run(async () => {
    const { db, tournament } = await getTournamentById(await env(), tournamentId);
    if (!tournament) throw new Error("not found");
    let done = 0;
    for (let i = 0; i < Math.min(count, 10); i++) {
      if (!(await simulateNextMatch(db, tournament))) break;
      done++;
    }
    return done === 0 ? { ok: false, key: "noMatchLeft" } : { ok: true, key: "simulated", values: { count: done } };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function rescore(tournamentId: string): Promise<ActionResult> {
  return run(async () => {
    const r = await rescoreTournament(await getDb(), tournamentId);
    return { ok: true, key: "rescored", values: r };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function buildPool(tournamentId: string, repriceAll: boolean): Promise<ActionResult> {
  return run(async () => {
    const r = await buildPoolOp(await getDb(), tournamentId, repriceAll);
    return { ok: true, key: "pool", values: r };
  }, `/admin/tournaments/${tournamentId}`);
}

export async function savePrices(tournamentId: string, prices: { playerId: string; price: number; isAvailable: boolean }[]): Promise<ActionResult> {
  return run(async () => {
    const db = await getDb();
    const { config } = await getGameConfig(db, tournamentId);
    const statements = prices.map((p) => {
      const price = Math.round(p.price);
      if (!Number.isFinite(price) || price < config.pricing.minPrice || price > config.pricing.maxPrice) throw new Error(`price out of range: ${p.price}`);
      return db
        .update(schema.poolPlayers)
        .set({ price, isAvailable: p.isAvailable })
        .where(and(eq(schema.poolPlayers.tournamentId, tournamentId), eq(schema.poolPlayers.playerId, p.playerId)));
    });
    for (let i = 0; i < statements.length; i += 50) {
      const [first, ...rest] = statements.slice(i, i + 50);
      if (first) await db.batch([first, ...rest]);
    }
    return { ok: true, key: "prices", values: { count: prices.length } };
  }, `/admin/tournaments/${tournamentId}`);
}

/** Saves a new active config version for a scope ("default" or a tournament ID) and re-scores affected tournaments. */
export async function saveGameConfig(scope: string, config: unknown): Promise<ActionResult> {
  const session = await requireAdmin();
  return run(async () => {
    const parsed = parseGameConfig(config);
    const db = await getDb();
    const [{ value: current }] = await db.select({ value: max(schema.gameConfigs.version) }).from(schema.gameConfigs).where(eq(schema.gameConfigs.scope, scope));
    const version = (current ?? 0) + 1;
    await db.batch([
      db.update(schema.gameConfigs).set({ isActive: false }).where(eq(schema.gameConfigs.scope, scope)),
      db.insert(schema.gameConfigs).values({
        id: crypto.randomUUID(),
        scope,
        version,
        configJson: JSON.stringify(parsed),
        isActive: true,
        createdBy: session.user.id,
      }),
    ]);
    await rescoreScope(scope);
    return { ok: true, key: "configSaved", values: { version } };
  }, "/admin/config");
}

export async function activateConfigVersion(scope: string, version: number): Promise<ActionResult> {
  return run(async () => {
    const db = await getDb();
    await db.batch([
      db.update(schema.gameConfigs).set({ isActive: false }).where(eq(schema.gameConfigs.scope, scope)),
      db
        .update(schema.gameConfigs)
        .set({ isActive: true })
        .where(and(eq(schema.gameConfigs.scope, scope), eq(schema.gameConfigs.version, version))),
    ]);
    await rescoreScope(scope);
    return { ok: true, key: "configSaved", values: { version } };
  }, "/admin/config");
}

async function rescoreScope(scope: string) {
  const db = await getDb();
  const tournaments =
    scope === "default"
      ? (
          await db
            .select({ id: schema.tournaments.id })
            .from(schema.tournaments)
            .where(inArray(schema.tournaments.fantasyStatus, ["open", "locked", "finished"]))
        ).map((t) => t.id)
      : [scope];
  for (const id of tournaments) await rescoreTournament(db, id);
}

export async function builtInDefaults() {
  await requireAdmin();
  return DEFAULT_GAME_CONFIG;
}
