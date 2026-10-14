import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const careSessions = sqliteTable("care_sessions", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(0),
});

// Family records use the trusted Sites visitor identity, never the demo actor.
export const familyHouseholds = sqliteTable('family_households', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), name: text('name').notNull(),
  cardsReviewed: integer('cards_reviewed').notNull().default(0),
  state: text('state').notNull().default('active'), createdAt: text('created_at').notNull(),
});
export const familyMembers = sqliteTable('family_members', {
  userId: text('user_id').primaryKey(), householdId: text('household_id').notNull(),
  role: text('role').notNull(), name: text('name').notNull(), avatarId: text('avatar_id'),
},table=>[index('family_members_household_idx').on(table.householdId)]);
export const familyInvites = sqliteTable('family_invites', {
  tokenHash: text('token_hash').primaryKey(), householdId: text('household_id').notNull(),
  role: text('role').notNull(), expiresAt: text('expires_at').notNull(), usedBy: text('used_by'),
});
export const familyMedia = sqliteTable('family_media', {
  id: text('id').primaryKey(), householdId: text('household_id').notNull(), ownerId: text('owner_id').notNull(),
  kind: text('kind').notNull(), mime: text('mime').notNull(), bytes: integer('bytes').notNull(),
  state: text('state').notNull().default('staged'), createdAt: text('created_at').notNull(),
},table=>[index('family_media_household_idx').on(table.householdId,table.state)]);
export const familyMessages = sqliteTable('family_messages', {
  id: text('id').primaryKey(), householdId: text('household_id').notNull(), senderId: text('sender_id').notNull(),
  recipientId: text('recipient_id').notNull(), clientKey: text('client_key').notNull().unique(),
  cards: text('cards').notNull(), text: text('text').notNull(), mediaIds: text('media_ids').notNull(),
  replyTo: text('reply_to'), sentAt: text('sent_at').notNull(), receivedAt: text('received_at'),
  openedAt: text('opened_at'), withdrawnAt: text('withdrawn_at'),
},table=>[index('family_messages_inbox_idx').on(table.householdId,table.recipientId,table.sentAt),index('family_messages_sent_idx').on(table.householdId,table.senderId,table.sentAt)]);
export const familyFeedback = sqliteTable('family_feedback', {
  id: text('id').primaryKey(), householdId: text('household_id').notNull(), userId: text('user_id').notNull(),
  category: text('category').notNull(), detail: text('detail').notNull(), createdAt: text('created_at').notNull(),
});
export const familyAiUsage = sqliteTable('family_ai_usage', {
  scope: text('scope').primaryKey(), count: integer('count').notNull().default(0),
});
