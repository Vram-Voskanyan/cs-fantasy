import { createDb, schema } from "@cs-vv-fantasy/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { buildPool, setFantasyStatus } from "@/jobs/admin-ops";
import { fillFakeTournament, simulateNextMatch } from "@/jobs/fake-data";

export const dynamic = "force-dynamic";

// Test setup without an admin account: POST {"slug": "...", "simulate": 0} with "Authorization: Bearer <SYNC_TOKEN>".
// Opens the fantasy game, fills fake teams and matches (Cito shape), builds the pool, optionally plays N matches.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { slug?: string; simulate?: number };
  if (!body.slug) return Response.json({ ok: false, error: "slug required" }, { status: 400 });

  const db = createDb(env.DB);
  const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.slug, body.slug)).limit(1);
  if (!tournament) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  await setFantasyStatus(db, tournament, "open");
  const fake = await fillFakeTournament(db, tournament);
  const pool = await buildPool(db, tournament.id, false);
  let simulated = 0;
  for (let i = 0; i < Math.min(body.simulate ?? 0, 10); i++) {
    if (!(await simulateNextMatch(db, tournament))) break;
    simulated++;
  }
  return Response.json({ ok: true, ...fake, pool: pool.count, simulated });
}
