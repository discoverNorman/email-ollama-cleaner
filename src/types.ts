export type Classification = 'spam' | 'newsletter' | 'keep' | 'unknown';
export type TaskStatus = 'pending' | 'completed' | 'failed';

export interface EmailMessage {
  messageId: string;
  fromAddr: string;
  subject: string;
  body: string;
  date: Date;
  headers: Record<string, string>;
}

export interface OllamaClassification {
  classification: Classification;
  confidence: number;
  reasoning?: string;
}

export interface UnsubscribeInfo {
  url: string | null;
  method: 'link' | 'mailto' | 'one-click' | 'none';
}

export interface ScanStats {
  emailsProcessed: number;
  spamCount: number;
  newsletterCount: number;
  keepCount: number;
}

export interface StatsResponse {
  totalEmails: number;
  spamCount: number;
  newsletterCount: number;
  keepCount: number;
  pendingUnsubscribes: number;
  emailsByDate: Record<string, number>;
  classificationBreakdown: Record<string, number>;
}

export interface ScanResponse {
  status: string;
  emailsProcessed: number;
  spamCount: number;
  newsletterCount: number;
  keepCount: number;
}

export interface HealthResponse {
  status: string;
  ollamaConnected: boolean;
  timestamp: string;
}

export interface ImportStatus {
  active: boolean;
  phase: string;
  currentFolder: string;
  foldersProcessed: number;
  totalFolders: number;
  emailsFound: number;
  emailsImported: number;
  duplicatesSkipped: number;
  error?: string;
}
