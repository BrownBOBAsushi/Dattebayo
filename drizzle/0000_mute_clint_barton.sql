CREATE TABLE `survival_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`name` text,
	`survived_ms` integer,
	`jutsus` integer,
	`signs` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `survival_ranking` ON `survival_runs` (`survived_ms`,`jutsus`,`completed_at`);