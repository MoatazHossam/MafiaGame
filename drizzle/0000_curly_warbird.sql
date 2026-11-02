CREATE TABLE `mafia_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `limits_expiry` ON `mafia_limits` (`expires`);--> statement-breakpoint
CREATE TABLE `mafia_presence` (
	`member_id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`last_seen` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `mafia_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `presence_room` ON `mafia_presence` (`room_code`);--> statement-breakpoint
CREATE TABLE `mafia_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`state` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rooms_expiry` ON `mafia_rooms` (`expires`);--> statement-breakpoint
CREATE TABLE `mafia_sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`member_id` text NOT NULL,
	`client_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `mafia_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_room` ON `mafia_sessions` (`room_code`);--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `mafia_sessions` (`expires`);