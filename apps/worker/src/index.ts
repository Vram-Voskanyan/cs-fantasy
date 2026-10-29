import { syncEvents } from "./sync-events";

// Background worker: data ingest (cron) and scoring (queue). docs/PLAN.md section 5.4.

export type ScoringJob = { type: "score-map"; mapId: string };

function authorized(request: Request, env: Env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(env.SYNC_TOKEN) && token === env.SYNC_TOKEN;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    // Manual sync for admins: POST /sync/events with "Authorization: Bearer <SYNC_TOKEN>".
    if (url.pathname === "/sync/events" && request.method === "POST") {
      if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });
      try {
        return Response.json({ ok: true, ...(await syncEvents(env)) });
      } catch (error) {
        console.error("[ingest] manual sync failed", error);
        return Response.json({ ok: false, error: String(error) }, { status: 502 });
      }
    }
    return Response.json({ ok: true, service: "cs-vv-fantasy-worker" }, { headers: { "cache-control": "no-store" } });
  },

  async scheduled(controller, env): Promise<void> {
    console.log(`[ingest] cron "${controller.cron}" (${env.APP_ENV})`);
    await syncEvents(env);
  },

  async queue(batch, env): Promise<void> {
    for (const message of batch.messages) {
      console.log(`[scoring] ${env.APP_ENV}: job ${message.id} received, scoring not implemented yet`);
      message.ack();
    }
  },
} satisfies ExportedHandler<Env, ScoringJob>;
