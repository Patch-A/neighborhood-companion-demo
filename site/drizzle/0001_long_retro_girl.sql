CREATE TABLE `family_ai_usage` (
	`scope` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_households` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`cards_reviewed` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_invites` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_by` text
);
--> statement-breakpoint
CREATE TABLE `family_media` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`bytes` integer NOT NULL,
	`state` text DEFAULT 'staged' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`avatar_id` text
);
--> statement-breakpoint
CREATE TABLE `family_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`client_key` text NOT NULL,
	`cards` text NOT NULL,
	`text` text NOT NULL,
	`media_ids` text NOT NULL,
	`reply_to` text,
	`sent_at` text NOT NULL,
	`received_at` text,
	`opened_at` text,
	`withdrawn_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_messages_client_key_unique` ON `family_messages` (`client_key`);