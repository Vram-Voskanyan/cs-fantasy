import { createDb, schema } from "@cs-vv-fantasy/db";
import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type CitoEvent, citoGet } from "./cito";
import { resolveIds } from "./ingest";

type Status = (typeof schema.tournamentStatuses)[number];

function toStatus(event: CitoEvent, now: number): Status {
  const ends = event.endsAt ? Date.parse(event.endsAt) : null;
  if (event.status === "cancelled") return "cancelled";
  if (ends !== null && ends < now) return "finished";
  if (event.status === "live") return "live";
  return "upcoming";
}

const toDate = (value: string | null) => (value ? new Date(value) : null);

// One provider call: live events plus the next upcoming ones.
export async function syncEvents(env: CloudflareEnv) {
  const started = Date.now();
  const body = await citoGet<CitoEvent[]>(env.CITO_API_KEY, "/cs2/events/active", {
    includeUpcoming: "true",
    upcomingLimit: "40",
    limit: "60",
  });
  const events = body.data ?? [];

  // Keep the raw response for replay and debugging (docs/PLAN.md section 4.3).
  await env.STORAGE.put(`raw/cito/events-active/${new Date(started).toISOString()}.json`, JSON.stringify(body), {
    httpMetadata: { contentType: "application/json" },
  });

  const db = createDb(env.DB);
  const { map: ids, created } = await resolveIds(
    db,
    "cito",
    "tournament",
    events.map((e) => e.id),
  );

  const syncedAt = new Date(started);
  const statements: BatchItem<"sqlite">[] = events.map((event) => {
    const values = {
      slug: event.slug,
      name: event.name,
      tier: event.tier,
      status: toStatus(event, started),
      startsAt: toDate(event.startsAt),
      endsAt: toDate(event.endsAt),
      location: event.location,
      isLan: event.isLan,
      prizePool: event.prizePool === null ? null : Math.round(event.prizePool),
      currency: event.currency,
      teamCount: event.teamCount,
      format: event.format,
      logoUrl: event.logoUrl,
      bannerUrl: event.bannerImageUrl,
      syncedAt,
    };
    const id = ids.get(event.id)!;
    return created.has(event.id)
      ? db.insert(schema.tournaments).values({ id, ...values })
      : db.update(schema.tournaments).set(values).where(eq(schema.tournaments.id, id));
  });
  for (let i = 0; i < statements.length; i += 50) {
    const [first, ...rest] = statements.slice(i, i + 50);
    if (first) await db.batch([first, ...rest]);
  }

  const summary = { events: events.length, created: created.size, updated: events.length - created.size, ms: Date.now() - started };
  console.log(`[ingest] events synced`, summary);
  return summary;
}
