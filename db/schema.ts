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
