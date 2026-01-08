import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { config } from '../config.js';
import * as schema from './schema.js';

const sqlite = new Database(config.app.databaseUrl);
export const db = drizzle(sqlite, { schema });

// Optimized prompt for qwen2.5:0.5b - short and direct for speed
const DEFAULT_PROMPT = `Classify this email as spam, newsletter, or keep.

spam = junk, scam, phishing, unwanted ads
newsletter = subscriptions, marketing, updates from companies
keep = personal, work, receipts, important

From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

Reply JSON only: {"classification":"spam|newsletter|keep","confidence":0.9}`;

export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      from_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_preview TEXT,
      date INTEGER,
      classification TEXT DEFAULT 'unknown',
      confidence REAL DEFAULT 0,
      processed_at INTEGER DEFAULT (unixepoch()),
      deleted INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS unsubscribe_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER REFERENCES emails(id),
      sender TEXT NOT NULL,
      unsubscribe_url TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (unixepoch()),
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS scan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER DEFAULT (unixepoch()),
      completed_at INTEGER,
      emails_processed INTEGER DEFAULT 0,
      spam_count INTEGER DEFAULT 0,
      newsletter_count INTEGER DEFAULT 0,
      keep_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS email_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      from_addr TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_preview TEXT,
      email_date INTEGER,
      headers TEXT,
      status TEXT DEFAULT 'pending',
      worker_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      started_at INTEGER,
      completed_at INTEGER,
      result TEXT,
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_emails_message_id ON emails(message_id);
    CREATE INDEX IF NOT EXISTS idx_emails_from_addr ON emails(from_addr);
    CREATE INDEX IF NOT EXISTS idx_emails_classification ON emails(classification);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON email_queue(status);
  `);

  // Initialize default settings if not exist
  const defaultSettings = [
    ['ollama_host', 'http://192.168.1.207:11434'],
    ['ollama_model', 'qwen2.5:0.5b'],
    ['ollama_prompt', DEFAULT_PROMPT],
    ['worker_count', '16'],
    ['queue_enabled', 'true'],
    // IMAP settings
    ['imap_configured', 'false'],
    ['imap_provider', ''],
    ['imap_host', ''],
    ['imap_port', '993'],
    ['imap_user', ''],
    ['imap_password', ''],
    ['imap_use_ssl', 'true'],
  ];

  const stmt = sqlite.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaultSettings) {
    stmt.run(key, value);
  }

  console.log('Database initialized');
}

export function getSetting(key: string): string | null {
  const row = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  sqlite.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch())').run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = sqlite.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export { schema };
