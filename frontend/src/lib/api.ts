export interface Email {
  id: number;
  messageId: string;
  fromAddr: string;
  subject: string;
  bodyPreview: string | null;
  date: number | null;
  classification: 'spam' | 'newsletter' | 'keep' | 'unknown';
  confidence: number;
  processedAt: number;
  deleted: number;
}

export interface UnsubscribeTask {
  id: number;
  emailId: number;
  sender: string;
  unsubscribeUrl: string;
  method: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: number;
  completedAt: number | null;
}

export interface ScanLog {
  id: number;
  startedAt: number;
  completedAt: number | null;
  emailsProcessed: number;
  spamCount: number;
  newsletterCount: number;
  keepCount: number;
}

export interface Stats {
  totalEmails: number;
  spamCount: number;
  newsletterCount: number;
  keepCount: number;
  pendingUnsubscribes: number;
  emailsByDate: Record<string, number>;
  classificationBreakdown: Record<string, number>;
}

export interface HealthStatus {
  status: string;
  ollamaConnected: boolean;
  timestamp: string;
}

export interface ScanResult {
  status: string;
  emailsProcessed: number;
  spamCount: number;
  newsletterCount: number;
  keepCount: number;
}

// Detect if running in Electron and get the appropriate base URL
async function getBaseUrl(): Promise<string> {
  // Check if we're in Electron
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    const backendUrl = await (window as any).electronAPI.getBackendUrl();
    return `${backendUrl}/api`;
  }

  // In web mode, use relative URL
  return '/api';
}

// Initialize base URL (defaults to web mode for immediate usage)
let BASE_URL = '/api';

// Update BASE_URL if we're in Electron (async initialization)
if (typeof window !== 'undefined' && (window as any).electronAPI) {
  getBaseUrl().then(url => {
    BASE_URL = url;
  });
}

// Export a function to check if running in Electron
export function isElectron(): boolean {
  return typeof window !== 'undefined' && (window as any).electronAPI !== undefined;
}

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${BASE_URL}/stats`);
  return res.json();
}

export async function getEmails(classification?: string, limit = 50, offset = 0): Promise<Email[]> {
  const params = new URLSearchParams();
  if (classification) params.set('classification', classification);
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  const res = await fetch(`${BASE_URL}/emails?${params}`);
  return res.json();
}

export async function triggerScan(limit = 50): Promise<ScanResult> {
  const res = await fetch(`${BASE_URL}/scan?limit=${limit}`, { method: 'POST' });
  return res.json();
}

export async function classifyEmails(emailIds: number[]): Promise<{ status: string; message?: string; total?: number }> {
  const res = await fetch(`${BASE_URL}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailIds }),
  });
  return res.json();
}

// Classify a single email synchronously (immediate priority)
export interface ClassifySingleResult {
  status: string;
  emailId?: number;
  classification?: string;
  confidence?: number;
  message?: string;
}

export async function classifySingleEmail(emailId: number): Promise<ClassifySingleResult> {
  const res = await fetch(`${BASE_URL}/classify/single/${emailId}`, {
    method: 'POST',
  });
  return res.json();
}

export interface ClassifyJobStatus {
  running: boolean;
  result: {
    status: string;
    emailsProcessed: number;
    spamCount: number;
    newsletterCount: number;
    keepCount: number;
  } | null;
}

export async function getClassifyStatus(): Promise<ClassifyJobStatus> {
  const res = await fetch(`${BASE_URL}/classify/status`);
  return res.json();
}

export async function getPendingUnsubscribes(): Promise<UnsubscribeTask[]> {
  const res = await fetch(`${BASE_URL}/unsubscribe/pending`);
  return res.json();
}

export async function completeUnsubscribe(taskId: number): Promise<{ status: string; taskId: number }> {
  const res = await fetch(`${BASE_URL}/unsubscribe/${taskId}/complete`, { method: 'POST' });
  return res.json();
}

export interface UnsubscribeResult {
  taskId: number;
  success: boolean;
  method: string;
  statusCode?: number;
  explanation: string;
  nextAction?: string;
}

export async function executeUnsubscribe(taskId: number): Promise<UnsubscribeResult> {
  const res = await fetch(`${BASE_URL}/unsubscribe/${taskId}/execute`, { method: 'POST' });
  return res.json();
}

export interface ExecuteAllResult {
  status: string;
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    taskId: number;
    sender: string;
    success: boolean;
    explanation: string;
    nextAction?: string;
  }>;
}

export async function executeAllUnsubscribes(): Promise<ExecuteAllResult> {
  const res = await fetch(`${BASE_URL}/unsubscribe/execute-all`, { method: 'POST' });
  return res.json();
}

export async function getScans(limit = 20): Promise<ScanLog[]> {
  const res = await fetch(`${BASE_URL}/scans?limit=${limit}`);
  return res.json();
}

// Settings API
export interface OllamaSettings {
  ollama_host: string;
  ollama_model: string;
  ollama_prompt: string;
  worker_count: string;
  queue_enabled: string;
}

export async function getSettings(): Promise<OllamaSettings> {
  const res = await fetch(`${BASE_URL}/settings`);
  return res.json();
}

export async function updateSettings(settings: Partial<OllamaSettings>): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return res.json();
}

// Queue API
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  workers: Array<{
    id: string;
    running: boolean;
    currentItem: number | null;
    processedCount: number;
    startedAt: string | null;
  }>;
}

export async function getQueueStats(): Promise<QueueStats> {
  const res = await fetch(`${BASE_URL}/queue/stats`);
  return res.json();
}

export async function startQueue(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/queue/start`, { method: 'POST' });
  return res.json();
}

export async function stopQueue(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/queue/stop`, { method: 'POST' });
  return res.json();
}

export async function clearQueue(status?: 'completed' | 'failed'): Promise<{ status: string }> {
  const url = status ? `${BASE_URL}/queue/clear?status=${status}` : `${BASE_URL}/queue/clear`;
  const res = await fetch(url, { method: 'DELETE' });
  return res.json();
}

// Ollama API
export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest?: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

// Trash spam emails
export async function trashAllSpam(): Promise<{ status: string; trashedCount: number; totalSpam: number; errors?: string[] }> {
  const res = await fetch(`${BASE_URL}/emails/trash-spam`, { method: 'POST' });
  return res.json();
}

// Trash a single email
export async function trashEmail(emailId: number): Promise<{ status?: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/emails/${emailId}/trash`, { method: 'POST' });
  return res.json();
}

export async function getOllamaModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${BASE_URL}/ollama/models`);
  if (!res.ok) return [];
  return res.json();
}

export async function pullOllamaModel(name: string): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/ollama/models/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteOllamaModel(name: string): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/ollama/models/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function getOllamaModelInfo(name: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/ollama/models/${encodeURIComponent(name)}`);
  return res.json();
}

// Model config with optimal settings
export interface ModelConfig {
  model: string;
  prompt: string;
  batchPrompt: string;
  workers: number;
  batchSize: number;
  concurrency: number;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
}

export async function getModelConfig(modelName: string): Promise<ModelConfig> {
  const res = await fetch(`${BASE_URL}/ollama/config/${encodeURIComponent(modelName)}`);
  return res.json();
}

export function pullOllamaModelStream(name: string): EventSource | null {
  try {
    const url = `${BASE_URL}/ollama/models/pull/stream?name=${encodeURIComponent(name)}`;
    return new EventSource(url);
  } catch {
    return null;
  }
}

export async function testPrompt(email: { fromAddr: string; subject: string; bodyPreview: string }): Promise<{
  raw?: string;
  parsed?: Record<string, unknown>;
  error?: string;
  details?: string;
  rawError?: string;
  host?: string;
  model?: string;
}> {
  try {
    const res = await fetch(`${BASE_URL}/ollama/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email),
    });
    return res.json();
  } catch (e) {
    return { error: `Network error: ${e}` };
  }
}

// Ollama connection ping
export interface PingResult {
  connected: boolean;
  host: string;
  error?: string;
  rawError?: string;
  modelCount?: number;
  message?: string;
}

export async function pingOllama(): Promise<PingResult> {
  try {
    const res = await fetch(`${BASE_URL}/ollama/ping`);
    return res.json();
  } catch (e) {
    return { connected: false, host: 'unknown', error: `Network error: ${e}` };
  }
}

// IMAP Configuration API
export interface ImapProvider {
  id: string;
  name: string;
  host: string;
  port: number;
}

export interface ImapConfig {
  configured: boolean;
  provider: string;
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
}

export interface ImapTestResult {
  success: boolean;
  error?: string;
  mailboxCount?: number;
}

export async function getImapProviders(): Promise<ImapProvider[]> {
  const res = await fetch(`${BASE_URL}/imap/providers`);
  return res.json();
}

export async function getImapConfig(): Promise<ImapConfig> {
  const res = await fetch(`${BASE_URL}/imap/config`);
  return res.json();
}

export async function testImapConnection(config: {
  provider: string;
  host: string;
  port: number;
  user: string;
  password: string;
}): Promise<ImapTestResult> {
  const res = await fetch(`${BASE_URL}/imap/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function saveImapConfig(config: {
  provider: string;
  host: string;
  port: number;
  user: string;
  password: string;
}): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/imap/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function resetImapConfig(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/imap/config`, { method: 'DELETE' });
  return res.json();
}

// Scan Status API
export interface ScanStatus {
  active: boolean;
  phase: string;
  current: number;
  total: number;
  currentEmail?: string;
  currentEmailFrom?: string;
  currentEmailId?: number;
  startTime?: number;
  avgTimePerEmail?: number;
  concurrency?: number;
}

export async function getScanStatus(): Promise<ScanStatus> {
  const res = await fetch(`${BASE_URL}/scan/status`);
  return res.json();
}

// Import Status API
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

export async function getImportStatus(): Promise<ImportStatus> {
  const res = await fetch(`${BASE_URL}/import/status`);
  return res.json();
}

export async function startImport(): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${BASE_URL}/import`, { method: 'POST' });
  return res.json();
}

// Clear all local emails (doesn't affect Gmail)
export async function clearLocalEmails(): Promise<{ status: string }> {
  const res = await fetch(`${BASE_URL}/emails/clear`, { method: 'DELETE' });
  return res.json();
}

// Get email count
export async function getEmailCount(): Promise<{ count: number }> {
  const res = await fetch(`${BASE_URL}/emails/count`);
  return res.json();
}
