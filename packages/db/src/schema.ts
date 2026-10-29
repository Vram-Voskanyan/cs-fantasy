import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    // Where teams, players and matches come from: "cito", "fake" (test data) or null (not loaded yet).
    dataSource: text("data_source", { enum: ["cito", "fake"] }),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tournaments_starts_at_idx").on(t.startsAt), index("tournaments_status_idx").on(t.status)],
);

export type Tournament = typeof tournaments.$inferSelect;

// Field names follow the Cito API (docs/PLAN.md section 4.2). Nothing is stored that Cito does not return.

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tag: text("tag"),
  countryName: text("country_name"),
  countryCode: text("country_code"),
  region: text("region"),
  worldRanking: integer("world_ranking"),
  vrsRanking: integer("vrs_ranking"),
  logoUrl: text("logo_url"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  // When the roster was last loaded from the provider. Rosters are reused for 24 hours to save API calls.
  rosterSyncedAt: integer("roster_synced_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nickname: text("nickname").notNull(),
  realName: text("real_name"),
  countryName: text("country_name"),
  countryCode: text("country_code"),
  age: integer("age"),
  imageUrl: text("image_url"),
  // Cito career rating (cito_rating_1) and maps played, from the team roster.
  rating: real("rating"),
  mapsPlayed: integer("maps_played"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const teamPlayers = sqliteTable(
  "team_players",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    // Cito roster role, for example "AWPer", "Rifler", "IGL", "coach".
    role: text("role"),
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    fromAt: integer("from_at", { mode: "timestamp_ms" }),
    toAt: integer("to_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.playerId] }), index("team_players_player_idx").on(t.playerId)],
);

export const tournamentTeams = sqliteTable(
  "tournament_teams",
  {
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seed: integer("seed"),
    placement: integer("placement"),
    status: text("status"),
  },
  (t) => [primaryKey({ columns: [t.tournamentId, t.teamId] })],
);

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    stageName: text("stage_name"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    bestOf: integer("best_of"),
    // Cito status: "upcoming", "live", "completed", "cancelled", ...
    status: text("status").notNull(),
    team1Id: text("team1_id").references(() => teams.id),
    team2Id: text("team2_id").references(() => teams.id),
    team1Score: integer("team1_score"),
    team2Score: integer("team2_score"),
    winnerTeamId: text("winner_team_id").references(() => teams.id),
    isForfeit: integer("is_forfeit", { mode: "boolean" }),
    statsSyncedAt: integer("stats_synced_at", { mode: "timestamp_ms" }),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("matches_tournament_idx").on(t.tournamentId, t.startsAt)],
);

export const matchMaps = sqliteTable(
  "match_maps",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    mapNumber: integer("map_number").notNull(),
    mapName: text("map_name"),
    status: text("status").notNull(),
    team1Score: integer("team1_score"),
    team2Score: integer("team2_score"),
    winnerTeamId: text("winner_team_id").references(() => teams.id),
    durationRounds: integer("duration_rounds"),
    pickTeamId: text("pick_team_id"),
    isForfeit: integer("is_forfeit", { mode: "boolean" }),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("match_maps_match_number_idx").on(t.matchId, t.mapNumber)],
);

export const playerMapStats = sqliteTable(
  "player_map_stats",
  {
    mapId: text("map_id")
      .notNull()
      .references(() => matchMaps.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => teams.id),
    kills: integer("kills").notNull(),
    deaths: integer("deaths").notNull(),
    assists: integer("assists").notNull(),
    plusMinus: integer("plus_minus"),
    adr: real("adr"),
    kast: real("kast"),
    rating: real("rating"),
    headshots: integer("headshots"),
    headshotPercent: real("headshot_percent"),
    openingKills: integer("opening_kills"),
    openingDeaths: integer("opening_deaths"),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  },
  (t) => [primaryKey({ columns: [t.mapId, t.playerId] }), index("player_map_stats_player_idx").on(t.playerId)],
);

// ---- Fantasy game (our data) ----

export const gameConfigs = sqliteTable(
  "game_configs",
  {
    id: text("id").primaryKey(),
    // "default" or a tournament ID.
    scope: text("scope").notNull(),
    version: integer("version").notNull(),
    configJson: text("config_json").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull(),
    createdBy: text("created_by"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("game_configs_scope_version_idx").on(t.scope, t.version)],
);

// A stage locks at `lockAt`. A match belongs to the last stage that locked at or before its start.
export const fantasyStages = sqliteTable(
  "fantasy_stages",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    name: text("name").notNull(),
    lockAt: integer("lock_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("fantasy_stages_tournament_idx").on(t.tournamentId, t.lockAt)],
);

export const poolPlayers = sqliteTable(
  "pool_players",
  {
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // Credits ×10.
    price: integer("price").notNull(),
    isAvailable: integer("is_available", { mode: "boolean" }).notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.tournamentId, t.playerId] })],
);

export const fantasyTeams = sqliteTable(
  "fantasy_teams",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("fantasy_teams_user_tournament_idx").on(t.userId, t.tournamentId)],
);

export const fantasyPicks = sqliteTable(
  "fantasy_picks",
  {
    fantasyTeamId: text("fantasy_team_id")
      .notNull()
      .references(() => fantasyTeams.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => fantasyStages.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id),
    role: text("role"),
    priceAtPick: integer("price_at_pick").notNull(),
  },
  (t) => [primaryKey({ columns: [t.fantasyTeamId, t.stageId, t.playerId] })],
);

// Scored per player per map with the config version used. Role bonuses for every role.
export const playerMapPoints = sqliteTable(
  "player_map_points",
  {
    mapId: text("map_id")
      .notNull()
      .references(() => matchMaps.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    base: real("base").notNull(),
    breakdownJson: text("breakdown_json").notNull(),
    roleBonusJson: text("role_bonus_json").notNull(),
    configVersion: integer("config_version").notNull(),
    scoredAt: integer("scored_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.mapId, t.playerId] })],
);

export const fantasyTeamScores = sqliteTable(
  "fantasy_team_scores",
  {
    fantasyTeamId: text("fantasy_team_id")
      .notNull()
      .references(() => fantasyTeams.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => fantasyStages.id, { onDelete: "cascade" }),
    points: real("points").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.fantasyTeamId, t.stageId] })],
);

export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchMap = typeof matchMaps.$inferSelect;
export type FantasyStage = typeof fantasyStages.$inferSelect;
