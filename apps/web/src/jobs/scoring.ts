// Scoring queue consumer. Today scoring runs right after a sync; the queue is for re-scoring at scale.

import { createDb } from "@cs-vv-fantasy/db";
import { rescoreTournament, scoreMatch } from "./score";

export type ScoringJob = { type: "score-match"; matchId: string } | { type: "rescore-tournament"; tournamentId: string };

export async function handleScoringBatch(batch: MessageBatch<ScoringJob>, env: CloudflareEnv) {
  const db = createDb(env.DB);
  for (const message of batch.messages) {
    const job = message.body;
    if (job.type === "score-match") await scoreMatch(db, job.matchId);
    else if (job.type === "rescore-tournament") await rescoreTournament(db, job.tournamentId);
    message.ack();
  }
}
