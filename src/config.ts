import 'dotenv/config';
import { join, isAbsolute } from 'path';

function resolveDbPath(dbUrl: string): string {
  if (isAbsolute(dbUrl)) return dbUrl;
  if (dbUrl.startsWith('./')) return join(process.cwd(), dbUrl.slice(2));
  return join(process.cwd(), dbUrl);
}

export const config = {
  gmail: {
    email: process.env.GMAIL_EMAIL ?? '',
    appPassword: process.env.GMAIL_APP_PASSWORD ?? '',
  },
  ollama: {
    host: process.env.OLLAMA_HOST ?? 'http://192.168.1.207:11434',
    model: process.env.OLLAMA_MODEL ?? 'qwen2.5:0.5b',
  },
  app: {
    useMockImap: (process.env.USE_MOCK_IMAP ?? 'true').toLowerCase() === 'true',
    databaseUrl: resolveDbPath(process.env.DATABASE_URL ?? 'emails.db'),
    batchSize: parseInt(process.env.BATCH_SIZE ?? '50', 10),
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
} as const;
