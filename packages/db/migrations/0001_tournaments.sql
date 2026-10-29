CREATE TABLE `external_ids` (
	`provider` text NOT NULL,
	`entity_type` text NOT NULL,
	`provider_id` text NOT NULL,
	`internal_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`provider`, `entity_type`, `provider_id`)
);
--> statement-breakpoint
CREATE INDEX `external_ids_internal_idx` ON `external_ids` (`entity_type`,`internal_id`);--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`tier` text,
	`status` text NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`location` text,
	`is_lan` integer,
	`prize_pool` integer,
	`currency` text,
	`team_count` integer,
	`format` text,
	`logo_url` text,
	`banner_url` text,
	`fantasy_status` text DEFAULT 'none' NOT NULL,
	`synced_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tournaments_slug_unique` ON `tournaments` (`slug`);--> statement-breakpoint
CREATE INDEX `tournaments_starts_at_idx` ON `tournaments` (`starts_at`);--> statement-breakpoint
CREATE INDEX `tournaments_status_idx` ON `tournaments` (`status`);