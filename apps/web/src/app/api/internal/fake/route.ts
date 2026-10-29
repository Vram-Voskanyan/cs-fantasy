import { createDb, schema } from "@cs-vv-fantasy/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { buildPool, setFantasyStatus } from "@/jobs/admin-ops";
import { fillFakeTournament, simulateNextMatch } from "@/jobs/fake-data";
import { addFakeFantasyTeams } from "@/jobs/fake-users";
import { addTeamToTournament, syncVrsRankings } from "@/jobs/sync-tournament";

export const dynamic = "force-dynamic";

// Test setup without an admin account: POST {"slug": "...", "simulate": 0, "reprice": false, "addTeams": ["vitality"], "fill": true}
// with "Authorization: Bearer <SYNC_TOKEN>". addTeams loads real Cito teams first (1 call each).
// "fill": false only simulates more matches on the existing fake schedule. "fakeUsers": 40 adds fake fantasy players.
// Opens the fantasy game, fills fake teams and matches (Cito shape), builds the pool, optionally plays N matches.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) return new Response("Unauthorized", { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    simulate?: number;
    reprice?: boolean;
    addTeams?: string[];
    fill?: boolean;
    fakeUsers?: number;
  };
  if (!body.slug) return Response.json({ ok: false, error: "slug required" }, { status: 400 });

  const db = createDb(env.DB);
  const [tournament] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.slug, body.slug)).limit(1);
  if (!tournament) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  const added = [];
  for (const team of body.addTeams ?? []) added.push(await addTeamToTournament(env, tournament.id, team));
  if (added.length > 0) await syncVrsRankings(env);
  let fake = {};
  let pool = { count: 0 };
  if (body.fill !== false) {
    await setFantasyStatus(db, tournament, "open");
    fake = await fillFakeTournament(db, tournament);
    pool = await buildPool(db, tournament.id, body.reprice ?? false);
  }
  let simulated = 0;
  for (let i = 0; i < Math.min(body.simulate ?? 0, 10); i++) {
    if (!(await simulateNextMatch(db, tournament))) break;
    simulated++;
  }
  const users = body.fakeUsers ? await addFakeFantasyTeams(db, tournament, Math.min(body.fakeUsers, 200)) : null;
  return Response.json({ ok: true, added, ...fake, pool: pool.count, simulated, users });
}
