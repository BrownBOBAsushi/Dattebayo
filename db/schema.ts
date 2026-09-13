import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const survivalRuns = sqliteTable('survival_runs', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at').notNull(),
  name: text('name'),
  survivedMs: integer('survived_ms'),
  jutsus: integer('jutsus'),
  signs: integer('signs'),
  completedAt: integer('completed_at'),
}, table => [index('survival_ranking').on(table.survivedMs, table.jutsus, table.completedAt)]);

export const multiplayerRooms = sqliteTable('multiplayer_rooms', {
  code: text('code').primaryKey(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('waiting'),
  hostToken: text('host_token').notNull().unique(),
  guestToken: text('guest_token').unique(),
  hostName: text('host_name').notNull(),
  guestName: text('guest_name'),
  hostSeen: integer('host_seen').notNull(),
  guestSeen: integer('guest_seen'),
  hostReady: integer('host_ready').notNull().default(0),
  guestReady: integer('guest_ready').notNull().default(0),
  hostScore: integer('host_score').notNull().default(0),
  guestScore: integer('guest_score').notNull().default(0),
  startsAt: integer('starts_at'),
  createdAt: integer('created_at').notNull(),
  sequence: text('sequence').notNull(),
}, table => [index('multiplayer_queue').on(table.kind, table.status, table.createdAt)]);
