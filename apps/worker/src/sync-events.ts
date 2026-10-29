import { createDb, schema } from "@cs-vv-fantasy/db";
import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { type CitoEvent, citoGet } from "./cito";

const PROVIDER = "cito";
const ENTITY = "tournament";

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
export async function syncEvents(env: Env) {
  const started = Date.now();
  const { body } = await citoGet<CitoEvent>(env.CITO_API_KEY, "/cs2/events/active", {
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
  const ids = events.map((e) => e.id);
  const known = ids.length
    ? await db
        .select({ providerId: schema.externalIds.providerId, internalId: schema.externalIds.internalId })
        .from(schema.externalIds)
        .where(
          and(
            eq(schema.externalIds.provider, PROVIDER),
            eq(schema.externalIds.entityType, ENTITY),
            inArray(schema.externalIds.providerId, ids),
          ),
        )
    : [];
  const internalByProvider = new Map(known.map((k) => [k.providerId, k.internalId]));

  const syncedAt = new Date(started);
  let created = 0;
  const statements: BatchItem<"sqlite">[] = [];
  for (const event of events) {
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
    const internalId = internalByProvider.get(event.id);
    if (internalId) {
      statements.push(db.update(schema.tournaments).set(values).where(eq(schema.tournaments.id, internalId)));
      continue;
    }
    created += 1;
    const id = crypto.randomUUID();
    statements.push(
      db.insert(schema.tournaments).values({ id, ...values }),
      db.insert(schema.externalIds).values({ provider: PROVIDER, entityType: ENTITY, providerId: event.id, internalId: id }),
    );
  }

  if (statements.length > 0) {
    const [first, ...rest] = statements;
    await db.batch([first, ...rest]);
  }

  const summary = { events: events.length, created, updated: events.length - created, ms: Date.now() - started };
  console.log(`[ingest] events synced`, summary);
  return summary;
}
