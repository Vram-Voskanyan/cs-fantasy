CREATE TABLE `fantasy_picks` (
	`fantasy_team_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`player_id` text NOT NULL,
	`role` text,
	`price_at_pick` integer NOT NULL,
	PRIMARY KEY(`fantasy_team_id`, `stage_id`, `player_id`),
	FOREIGN KEY (`fantasy_team_id`) REFERENCES `fantasy_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stage_id`) REFERENCES `fantasy_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fantasy_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`order` integer NOT NULL,
	`name` text NOT NULL,
	`lock_at` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fantasy_stages_tournament_idx` ON `fantasy_stages` (`tournament_id`,`lock_at`);--> statement-breakpoint
CREATE TABLE `fantasy_team_scores` (
	`fantasy_team_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`points` real NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`fantasy_team_id`, `stage_id`),
	FOREIGN KEY (`fantasy_team_id`) REFERENCES `fantasy_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stage_id`) REFERENCES `fantasy_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fantasy_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fantasy_teams_user_tournament_idx` ON `fantasy_teams` (`user_id`,`tournament_id`);--> statement-breakpoint
CREATE TABLE `game_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`version` integer NOT NULL,
	`config_json` text NOT NULL,
	`is_active` integer NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_configs_scope_version_idx` ON `game_configs` (`scope`,`version`);--> statement-breakpoint
CREATE TABLE `match_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`map_number` integer NOT NULL,
	`map_name` text,
	`status` text NOT NULL,
	`team1_score` integer,
	`team2_score` integer,
	`winner_team_id` text,
	`duration_rounds` integer,
	`pick_team_id` text,
	`is_forfeit` integer,
	`synced_at` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_maps_match_number_idx` ON `match_maps` (`match_id`,`map_number`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`stage_name` text,
	`starts_at` integer,
	`ends_at` integer,
	`best_of` integer,
	`status` text NOT NULL,
	`team1_id` text,
	`team2_id` text,
	`team1_score` integer,
	`team2_score` integer,
	`winner_team_id` text,
	`is_forfeit` integer,
	`stats_synced_at` integer,
	`synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team1_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team2_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matches_tournament_idx` ON `matches` (`tournament_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `player_map_points` (
	`map_id` text NOT NULL,
	`player_id` text NOT NULL,
	`base` real NOT NULL,
	`breakdown_json` text NOT NULL,
	`role_bonus_json` text NOT NULL,
	`config_version` integer NOT NULL,
	`scored_at` integer NOT NULL,
	PRIMARY KEY(`map_id`, `player_id`),
	FOREIGN KEY (`map_id`) REFERENCES `match_maps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_map_stats` (
	`map_id` text NOT NULL,
	`player_id` text NOT NULL,
	`team_id` text,
	`kills` integer NOT NULL,
	`deaths` integer NOT NULL,
	`assists` integer NOT NULL,
	`plus_minus` integer,
	`adr` real,
	`kast` real,
	`rating` real,
	`headshots` integer,
	`headshot_percent` real,
	`opening_kills` integer,
	`opening_deaths` integer,
	`synced_at` integer,
	PRIMARY KEY(`map_id`, `player_id`),
	FOREIGN KEY (`map_id`) REFERENCES `match_maps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `player_map_stats_player_idx` ON `player_map_stats` (`player_id`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`nickname` text NOT NULL,
	`real_name` text,
	`country_name` text,
	`country_code` text,
	`age` integer,
	`image_url` text,
	`rating` real,
	`maps_played` integer,
	`synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_slug_unique` ON `players` (`slug`);--> statement-breakpoint
CREATE TABLE `pool_players` (
	`tournament_id` text NOT NULL,
	`player_id` text NOT NULL,
	`team_id` text NOT NULL,
	`price` integer NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`tournament_id`, `player_id`),
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team_players` (
	`team_id` text NOT NULL,
	`player_id` text NOT NULL,
	`role` text,
	`is_active` integer NOT NULL,
	`from_at` integer,
	`to_at` integer,
	PRIMARY KEY(`team_id`, `player_id`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_players_player_idx` ON `team_players` (`player_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tag` text,
	`country_name` text,
	`country_code` text,
	`region` text,
	`world_ranking` integer,
	`vrs_ranking` integer,
	`logo_url` text,
	`synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);--> statement-breakpoint
CREATE TABLE `tournament_teams` (
	`tournament_id` text NOT NULL,
	`team_id` text NOT NULL,
	`seed` integer,
	`placement` integer,
	`status` text,
	PRIMARY KEY(`tournament_id`, `team_id`),
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `tournaments` ADD `data_source` text;