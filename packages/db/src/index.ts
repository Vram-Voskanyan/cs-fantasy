import { type AnyD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export { schema };
export type { FantasyStage, Match, MatchMap, Player, Team, Tournament } from "./schema";

export function createDb(d1: AnyD1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;
