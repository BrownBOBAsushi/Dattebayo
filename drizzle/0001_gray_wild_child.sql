CREATE TABLE `multiplayer_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`host_token` text NOT NULL,
	`guest_token` text,
	`host_name` text NOT NULL,
	`guest_name` text,
	`host_seen` integer NOT NULL,
	`guest_seen` integer,
	`host_ready` integer DEFAULT 0 NOT NULL,
	`guest_ready` integer DEFAULT 0 NOT NULL,
	`host_score` integer DEFAULT 0 NOT NULL,
	`guest_score` integer DEFAULT 0 NOT NULL,
	`starts_at` integer,
	`created_at` integer NOT NULL,
	`sequence` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `multiplayer_rooms_host_token_unique` ON `multiplayer_rooms` (`host_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `multiplayer_rooms_guest_token_unique` ON `multiplayer_rooms` (`guest_token`);--> statement-breakpoint
CREATE INDEX `multiplayer_queue` ON `multiplayer_rooms` (`kind`,`status`,`created_at`);