import { createDb, schema } from "@cs-vv-fantasy/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { buildPool, clearTournamentData, setFantasyStatus } from "@/jobs/admin-ops";
import { syncTournamentMatches, syncTournamentTeams } from "@/jobs/sync-tournament";

export const dynamic = "force-dynamic";

// Loads real data without an admin account: POST {"slug": "..."} with "Authorization: Bearer <SYNC_TOKEN>".
// Clears the tournament's current data (for example fake data), loads real teams, rosters and matches from Cito,
// opens the fantasy game and prices the pool. Cost: 2 calls + 1 per team whose roster is older than 24 hours.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!body.slug) return Response.json({ ok: false, error: "slug required" }, { status: 400 });

  const db = createDb(env.DB);
  const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.slug, body.slug)).limit(1);
  if (!tournament) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  try {
    if (tournament.dataSource !== "cito") await clearTournamentData(db, tournament.id);
    const teams = await syncTournamentTeams(env, tournament.id);
    const matches = await syncTournamentMatches(env, tournament.id);
    await setFantasyStatus(db, tournament, "open");
    const pool = await buildPool(db, tournament.id, true);
    return Response.json({ ok: true, teams, matches, pool: pool.count });
  } catch (error) {
    console.error("[ingest] real data load failed", error);
    return Response.json({ ok: false, error: String(error) }, { status: 502 });
  }
}
