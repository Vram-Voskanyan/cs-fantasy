import "server-only";
import { schema, type Tournament } from "@cs-vv-fantasy/db";
import { and, asc, desc, eq, gte, isNull, ne, or } from "drizzle-orm";
import { getDb } from "./db";

export type { Tournament };

// Which tournaments the home page features. Moves to the admin game config (docs/PLAN.md section 7.1).
const FEATURED_TIERS = ["S", "A"];
const FEATURED_MIN_PRIZE = 250_000;

export function isFeatured(t: Tournament) {
  if (t.fantasyStatus !== "none") return true;
  if (t.tier === "S") return true;
  return t.tier !== null && FEATURED_TIERS.includes(t.tier) && (t.prizePool ?? 0) >= FEATURED_MIN_PRIZE;
}

// Status at render time: provider status can lag behind the clock.
export function liveStatus(t: Tournament, now: Date): Tournament["status"] {
  if (t.status === "cancelled") return "cancelled";
  if (t.endsAt && t.endsAt < now) return "finished";
  if (t.status === "live" || (t.startsAt && t.startsAt <= now)) return "live";
  return "upcoming";
}

/** Live and upcoming tournaments, soonest first. */
export async function listCurrentTournaments(now = new Date()) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.tournaments)
    .where(
      and(
        ne(schema.tournaments.status, "cancelled"),
        or(isNull(schema.tournaments.endsAt), gte(schema.tournaments.endsAt, now)),
      ),
    )
    .orderBy(asc(schema.tournaments.startsAt), desc(schema.tournaments.prizePool));
  const live = rows.filter((t) => liveStatus(t, now) === "live");
  const upcoming = rows.filter((t) => liveStatus(t, now) === "upcoming");
  return { live, upcoming };
}

export async function getTournamentBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.slug, slug)).limit(1);
  return row ?? null;
}

export type TournamentFilter = { status: "all" | "live" | "upcoming" | "finished"; tier: string | null; fantasyOpen: boolean };

const FINISHED_SHOWN = 30;

/** Tournaments for the list page: live, upcoming and recently finished, with optional filters. */
export async function listTournaments(filter: TournamentFilter, now = new Date()) {
  const db = await getDb();
  const rows = await db.select().from(schema.tournaments).where(ne(schema.tournaments.status, "cancelled")).orderBy(asc(schema.tournaments.startsAt));
  const matches = rows.filter(
    (t) =>
      (!filter.tier || (filter.tier === "other" ? !t.tier || !["S", "A", "B", "C"].includes(t.tier) : t.tier === filter.tier)) &&
      (!filter.fantasyOpen || t.fantasyStatus === "open"),
  );
  const live = matches.filter((t) => liveStatus(t, now) === "live");
  const upcoming = matches.filter((t) => liveStatus(t, now) === "upcoming");
  const finished = matches
    .filter((t) => liveStatus(t, now) === "finished")
    .reverse()
    .slice(0, FINISHED_SHOWN);
  return {
    live: filter.status === "all" || filter.status === "live" ? live : [],
    upcoming: filter.status === "all" || filter.status === "upcoming" ? upcoming : [],
    finished: filter.status === "all" || filter.status === "finished" ? finished : [],
  };
}
