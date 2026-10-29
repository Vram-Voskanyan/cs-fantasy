import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Better Auth core tables (better-auth 1.7). Field names must match Better Auth's model.
// Timestamps are stored as integer milliseconds.

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`)
    .$onUpdate(() => new Date());

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  // "user" or "admin". Set by admins only, never by sign-up input.
  role: text("role").notNull().default("user"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---- Esports data (synced from the data provider, docs/PLAN.md section 4.3) ----

// Maps a provider's ID to our internal ID, so the provider can change without data migration.
export const externalIds = sqliteTable(
  "external_ids",
  {
    provider: text("provider").notNull(),
    entityType: text("entity_type").notNull(),
    providerId: text("provider_id").notNull(),
    internalId: text("internal_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.entityType, t.providerId] }),
    index("external_ids_internal_idx").on(t.entityType, t.internalId),
  ],
);

export const tournamentStatuses = ["upcoming", "live", "finished", "cancelled"] as const;
export const fantasyStatuses = ["none", "announced", "open", "locked", "finished"] as const;

export const tournaments = sqliteTable(
  "tournaments",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tier: text("tier"),
    status: text("status", { enum: tournamentStatuses }).notNull(),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    location: text("location"),
    isLan: integer("is_lan", { mode: "boolean" }),
    // Whole currency units, as the provider reports them.
    prizePool: integer("prize_pool"),
    currency: text("currency"),
    teamCount: integer("team_count"),
    format: text("format"),
    // Stored, but not shown until the provider license covers logos (docs/PLAN.md section 9).
    logoUrl: text("logo_url"),
    bannerUrl: text("banner_url"),
    // Set by admins when a fantasy game is created for the tournament.
    fantasyStatus: text("fantasy_status", { enum: fantasyStatuses }).notNull().default("none"),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tournaments_starts_at_idx").on(t.startsAt), index("tournaments_status_idx").on(t.status)],
);

export type Tournament = typeof tournaments.$inferSelect;
