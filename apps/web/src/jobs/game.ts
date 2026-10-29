// Game config and stage helpers, shared by pages and background jobs (no Next.js-only imports here).

import { type Db, type FantasyStage, schema } from "@cs-vv-fantasy/db";
import { DEFAULT_GAME_CONFIG, type GameConfig, parseGameConfig } from "@cs-vv-fantasy/scoring";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

export type ActiveConfig = { config: GameConfig; version: number; scope: string };

/** The tournament's active config, else the active default, else the built-in default (version 0). */
export async function getGameConfig(db: Db, tournamentId: string | null): Promise<ActiveConfig> {
  const scopes = tournamentId ? [tournamentId, "default"] : ["default"];
  const rows = await db
    .select()
    .from(schema.gameConfigs)
    .where(and(inArray(schema.gameConfigs.scope, scopes), eq(schema.gameConfigs.isActive, true)));
  const row = rows.find((r) => r.scope === tournamentId) ?? rows.find((r) => r.scope === "default");
  if (!row) return { config: DEFAULT_GAME_CONFIG, version: 0, scope: "default" };
  return { config: parseGameConfig(JSON.parse(row.configJson)), version: row.version, scope: row.scope };
}

export async function listConfigVersions(db: Db, scope: string) {
  return db.select().from(schema.gameConfigs).where(eq(schema.gameConfigs.scope, scope)).orderBy(desc(schema.gameConfigs.version));
}

export async function getStages(db: Db, tournamentId: string) {
  return db.select().from(schema.fantasyStages).where(eq(schema.fantasyStages.tournamentId, tournamentId)).orderBy(asc(schema.fantasyStages.lockAt));
}

/** The stage a match counts for: the last stage that locked at or before the match start. */
export function stageForMatch(stages: FantasyStage[], startsAt: Date | null) {
  if (stages.length === 0) return null;
  if (!startsAt) return stages[stages.length - 1];
  let current = stages[0];
  for (const s of stages) if (s.lockAt <= startsAt) current = s;
  return current;
}

/** The stage users can still edit: the first one that has not locked yet. */
export function openStage(stages: FantasyStage[], now: Date) {
  return stages.find((s) => s.lockAt > now) ?? null;
}

/** The stage being played: the last one that already locked. */
export function lockedStage(stages: FantasyStage[], now: Date) {
  return [...stages].reverse().find((s) => s.lockAt <= now) ?? null;
}
