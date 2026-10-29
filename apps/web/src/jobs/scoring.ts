// Scoring queue consumer. Scoring itself arrives in M3 (docs/PLAN.md section 7).

export type ScoringJob = { type: "score-map"; mapId: string };

export async function handleScoringBatch(batch: MessageBatch<ScoringJob>, env: CloudflareEnv) {
  for (const message of batch.messages) {
    console.log(`[scoring] ${env.APP_ENV}: job ${message.id} received, scoring not implemented yet`);
    message.ack();
  }
}
