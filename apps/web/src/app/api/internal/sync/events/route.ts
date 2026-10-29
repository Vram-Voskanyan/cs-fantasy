import { getCloudflareContext } from "@opennextjs/cloudflare";
import { syncEvents } from "@/jobs/sync-events";

export const dynamic = "force-dynamic";

// Manual tournament sync: POST with "Authorization: Bearer <SYNC_TOKEN>". The admin panel replaces this in M2.
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.SYNC_TOKEN || token !== env.SYNC_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await syncEvents(env)) });
  } catch (error) {
    console.error("[ingest] manual sync failed", error);
    return Response.json({ ok: false, error: String(error) }, { status: 502 });
  }
}
