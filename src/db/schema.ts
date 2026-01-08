import { sqliteTable, text, integer, real, blob, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Email Accounts table - stores multiple email accounts
export const emailAccounts = sqliteTable('email_accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(), // User-friendly name like "Personal Gmail"
  email: text('email').notNull().unique(), // The actual email address
  provider: text('provider').notNull(), // gmail, outlook, yahoo, custom
  imapHost: text('imap_host').notNull(),
  imapPort: integer('imap_port').notNull(),
  imapUser: text('imap_user').notNull(),
  imapPassword: text('imap_password').notNull(), // Encrypted in production
  isActive: integer('is_active').default(1), // 1 = active, 0 = inactive
  isDefault: integer('is_default').default(0), // 1 = default account, 0 = not default
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(new Date()),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
}, (table) => {
  return {
    emailIdx: uniqueIndex('email_accounts_email_idx').on(table.email),
    activeIdx: index('email_accounts_active_idx').on(table.isActive),
    defaultIdx: index('email_accounts_default_idx').on(table.isDefault),
  };
});

export const emails = sqliteTable('emails', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').references(() => emailAccounts.id), // Foreign key to email accounts
  messageId: text('message_id').notNull(),
  fromAddr: text('from_addr').notNull(),
  subject: text('subject').notNull(),
  bodyPreview: text('body_preview'),
  date: integer('date', { mode: 'timestamp' }),
  classification: text('classification', { enum: ['spam', 'newsletter', 'keep', 'unknown'] }).default('unknown'),
  confidence: real('confidence').default(0),
  processedAt: integer('processed_at', { mode: 'timestamp' }).default(new Date()),
  deleted: integer('deleted').default(0),
}, (table) => {
  return {
    accountIdIdx: index('emails_account_id_idx').on(table.accountId),
    messageIdIdx: uniqueIndex('emails_message_id_account_idx').on(table.messageId, table.accountId), // Composite unique
    classificationIdx: index('emails_classification_idx').on(table.classification),
    dateIdx: index('emails_date_idx').on(table.date),
    deletedIdx: index('emails_deleted_idx').on(table.deleted),
  };
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
  accountId: integer('account_id').references(() => emailAccounts.id), // Which account was scanned
  startedAt: integer('started_at', { mode: 'timestamp' }).default(new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  emailsProcessed: integer('emails_processed').default(0),
  spamCount: integer('spam_count').default(0),
  newsletterCount: integer('newsletter_count').default(0),
  keepCount: integer('keep_count').default(0),
}, (table) => {
  return {
    accountIdIdx: index('scan_logs_account_id_idx').on(table.accountId),
    startedAtIdx: index('scan_logs_started_at_idx').on(table.startedAt),
  };
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').unique().notNull(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(new Date()),
});

export const emailQueue = sqliteTable('email_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').references(() => emailAccounts.id), // Which account this email belongs to
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
}, (table) => {
  return {
    accountIdIdx: index('email_queue_account_id_idx').on(table.accountId),
    statusIdx: index('email_queue_status_idx').on(table.status),
    workerIdIdx: index('email_queue_worker_id_idx').on(table.workerId),
  };
});

export type EmailAccount = typeof emailAccounts.$inferSelect;
export type NewEmailAccount = typeof emailAccounts.$inferInsert;
export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;
export type UnsubscribeTask = typeof unsubscribeTasks.$inferSelect;
export type NewUnsubscribeTask = typeof unsubscribeTasks.$inferInsert;
export type ScanLog = typeof scanLogs.$inferSelect;
export type NewScanLog = typeof scanLogs.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type QueueItem = typeof emailQueue.$inferSelect;
