import { sqliteTable, text, integer, real, blob } from 'drizzle-orm/sqlite-core';

export const emails = sqliteTable('emails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id').unique().notNull(),
  fromAddr: text('from_addr').notNull(),
  subject: text('subject').notNull(),
  bodyPreview: text('body_preview'),
  date: integer('date', { mode: 'timestamp' }),
  classification: text('classification', { enum: ['spam', 'newsletter', 'keep', 'unknown'] }).default('unknown'),
  confidence: real('confidence').default(0),
  processedAt: integer('processed_at', { mode: 'timestamp' }).default(new Date()),
  deleted: integer('deleted').default(0),
});

export const unsubscribeTasks = sqliteTable('unsubscribe_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  emailId: integer('email_id').references(() => emails.id),
  sender: text('sender').notNull(),
  unsubscribeUrl: text('unsubscribe_url').notNull(),
  method: text('method').notNull(),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const scanLogs = sqliteTable('scan_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: integer('started_at', { mode: 'timestamp' }).default(new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  emailsProcessed: integer('emails_processed').default(0),
  spamCount: integer('spam_count').default(0),
  newsletterCount: integer('newsletter_count').default(0),
  keepCount: integer('keep_count').default(0),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(new Date()),
});

export const emailQueue = sqliteTable('email_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  messageId: text('message_id').notNull(),
  fromAddr: text('from_addr').notNull(),
  subject: text('subject').notNull(),
  bodyPreview: text('body_preview'),
  emailDate: integer('email_date', { mode: 'timestamp' }),
  headers: text('headers'), // JSON string
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).default('pending'),
  workerId: text('worker_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  result: text('result'), // JSON string with classification result
  error: text('error'),
});

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;
export type UnsubscribeTask = typeof unsubscribeTasks.$inferSelect;
export type NewUnsubscribeTask = typeof unsubscribeTasks.$inferInsert;
export type ScanLog = typeof scanLogs.$inferSelect;
export type NewScanLog = typeof scanLogs.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type QueueItem = typeof emailQueue.$inferSelect;
