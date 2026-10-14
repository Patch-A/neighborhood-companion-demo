CREATE INDEX `family_media_household_idx` ON `family_media` (`household_id`,`state`);--> statement-breakpoint
CREATE INDEX `family_members_household_idx` ON `family_members` (`household_id`);--> statement-breakpoint
CREATE INDEX `family_messages_inbox_idx` ON `family_messages` (`household_id`,`recipient_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `family_messages_sent_idx` ON `family_messages` (`household_id`,`sender_id`,`sent_at`);