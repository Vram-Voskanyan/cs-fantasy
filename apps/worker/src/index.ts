// Background worker skeleton (M1). Ingest arrives in M2, scoring in M3 (docs/PLAN.md section 5.4).

export type ScoringJob = { type: "score-map"; mapId: string };

export default {
  async fetch(): Promise<Response> {
    return Response.json({ ok: true, service: "cs-vv-fantasy-worker" }, { headers: { "cache-control": "no-store" } });
  },

  async scheduled(controller, env): Promise<void> {
    console.log(`[ingest] cron "${controller.cron}" (${env.APP_ENV}): nothing to sync yet`);
  },

  async queue(batch, env): Promise<void> {
    for (const message of batch.messages) {
      console.log(`[scoring] ${env.APP_ENV}: job ${message.id} received, scoring not implemented yet`);
      message.ack();
    }
  },
} satisfies ExportedHandler<Env, ScoringJob>;
