import { Hono } from 'hono';
import { eq, desc, sql } from 'drizzle-orm';
import { db, getAllSettings, setSetting, getSetting } from '../db/index.js';
import { emails, unsubscribeTasks, scanLogs, emailQueue } from '../db/schema.js';
import { OllamaClient, getPromptsForModel, getSupportedModels, getConfigForModel, getAllModelConfigs } from '../services/ollama-client.js';
import { EmailProcessor } from '../services/email-processor.js';
import { queueManager } from '../services/queue-worker.js';
import { UnsubscribeExecutor } from '../services/unsubscribe-executor.js';
import type { StatsResponse, ScanResponse, HealthResponse } from '../types.js';

export const api = new Hono();

api.get('/health', async (c) => {
  const ollama = new OllamaClient();
  const ollamaOk = await ollama.healthCheck();

  const response: HealthResponse = {
    status: 'ok',
    ollamaConnected: ollamaOk,
    timestamp: new Date().toISOString(),
  };

  return c.json(response);
});

api.get('/stats', async (c) => {
  const classificationCounts = await db
    .select({
      classification: emails.classification,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(emails)
    .groupBy(emails.classification);

  const breakdown: Record<string, number> = {};
  let total = 0;
  let spam = 0;
  let newsletter = 0;
  let keep = 0;

  for (const row of classificationCounts) {
    const cls = row.classification ?? 'unknown';
    breakdown[cls] = row.count;
    total += row.count;
    if (cls === 'spam') spam = row.count;
    if (cls === 'newsletter') newsletter = row.count;
    if (cls === 'keep') keep = row.count;
  }

  const pendingResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(unsubscribeTasks)
    .where(eq(unsubscribeTasks.status, 'pending'));
  const pendingUnsubs = pendingResult[0]?.count ?? 0;

  const emailsByDateResult = await db
    .select({
      date: sql<string>`date(processed_at, 'unixepoch')`.as('date'),
      count: sql<number>`count(*)`.as('count'),
    })
    .from(emails)
    .groupBy(sql`date(processed_at, 'unixepoch')`)
    .orderBy(sql`date(processed_at, 'unixepoch')`);

  const emailsByDate: Record<string, number> = {};
  for (const row of emailsByDateResult) {
    if (row.date) {
      emailsByDate[row.date] = row.count;
    }
  }

  const response: StatsResponse = {
    totalEmails: total,
    spamCount: spam,
    newsletterCount: newsletter,
    keepCount: keep,
    pendingUnsubscribes: pendingUnsubs,
    emailsByDate,
    classificationBreakdown: breakdown,
  };

  return c.json(response);
});

api.get('/emails', async (c) => {
  const classification = c.req.query('classification');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  const result = classification
    ? await db
        .select()
        .from(emails)
        .where(eq(emails.classification, classification as 'spam' | 'newsletter' | 'keep' | 'unknown'))
        .orderBy(desc(emails.processedAt))
        .limit(limit)
        .offset(offset)
    : await db.select().from(emails).orderBy(desc(emails.processedAt)).limit(limit).offset(offset);

  return c.json(result);
});

// Clear all local emails (doesn't affect Gmail)
api.delete('/emails/clear', async (c) => {
  const result = await db.delete(emails);
  return c.json({ status: 'cleared', message: 'All local emails cleared' });
});

// Get count of emails
api.get('/emails/count', async (c) => {
  const result = await db.select({ count: sql<number>`count(*)` }).from(emails);
  return c.json({ count: result[0]?.count ?? 0 });
});

api.post('/scan', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 100);

  const processor = new EmailProcessor();
  const stats = await processor.processEmails(limit);

  const response: ScanResponse = {
    status: 'completed',
    emailsProcessed: stats.emailsProcessed,
    spamCount: stats.spamCount,
    newsletterCount: stats.newsletterCount,
    keepCount: stats.keepCount,
  };

  return c.json(response);
});

// Background classification job state
let classifyJobRunning = false;
let classifyJobResult: {
  status: string;
  emailsProcessed: number;
  spamCount: number;
  newsletterCount: number;
  keepCount: number;
} | null = null;

// Classify existing emails by IDs (in order) - runs in background
api.post('/classify', async (c) => {
  const body = await c.req.json<{ emailIds: number[] }>();
  const emailIds = body.emailIds || [];

  if (emailIds.length === 0) {
    return c.json({ status: 'error', message: 'No email IDs provided' }, 400);
  }

  if (classifyJobRunning) {
    return c.json({ status: 'already_running', message: 'Classification already in progress' });
  }

  // Start classification in background (don't await)
  classifyJobRunning = true;
  classifyJobResult = null;

  const processor = new EmailProcessor();
  processor.classifyByIds(emailIds).then((stats) => {
    classifyJobResult = {
      status: 'completed',
      emailsProcessed: stats.emailsProcessed,
      spamCount: stats.spamCount,
      newsletterCount: stats.newsletterCount,
      keepCount: stats.keepCount,
    };
    classifyJobRunning = false;
  }).catch((err) => {
    classifyJobResult = {
      status: 'error',
      emailsProcessed: 0,
      spamCount: 0,
      newsletterCount: 0,
      keepCount: 0,
    };
    classifyJobRunning = false;
    console.error('Classification error:', err);
  });

  // Return immediately - job is running in background
  return c.json({
    status: 'started',
    message: `Classification started for ${emailIds.length} emails`,
    total: emailIds.length,
  });
});

// Check classification job status
api.get('/classify/status', (c) => {
  return c.json({
    running: classifyJobRunning,
    result: classifyJobResult,
  });
});

// Classify a single email synchronously (priority/immediate)
api.post('/classify/single/:id', async (c) => {
  const emailId = parseInt(c.req.param('id'), 10);

  const email = await db.query.emails.findFirst({
    where: eq(emails.id, emailId),
  });

  if (!email) {
    return c.json({ status: 'error', message: 'Email not found' }, 404);
  }

  if (email.classification !== 'unknown') {
    return c.json({ status: 'already_classified', classification: email.classification });
  }

  // Update scan status immediately to show truck animation
  updateScanStatus({
    active: true,
    phase: 'Classifying...',
    current: 0,
    total: 1,
    currentEmail: email.subject?.slice(0, 60) ?? '',
    currentEmailFrom: email.fromAddr,
    currentEmailId: emailId,
    startTime: Date.now(),
    concurrency: 1,
  });

  try {
    const ollamaClient = new OllamaClient();
    const classification = await ollamaClient.classifyEmail(
      email.fromAddr,
      email.subject ?? '',
      email.bodyPreview ?? ''
    );

    await db
      .update(emails)
      .set({
        classification: classification.classification,
        confidence: classification.confidence,
        processedAt: new Date(),
      })
      .where(eq(emails.id, emailId));

    updateScanStatus({ active: false, phase: 'Complete', current: 1, total: 1 });

    return c.json({
      status: 'classified',
      emailId,
      classification: classification.classification,
      confidence: classification.confidence,
    });
  } catch (err) {
    updateScanStatus({ active: false, phase: 'Error', current: 0, total: 0 });
    return c.json({ status: 'error', message: String(err) }, 500);
  }
});

api.get('/unsubscribe/pending', async (c) => {
  const result = await db
    .select()
    .from(unsubscribeTasks)
    .where(eq(unsubscribeTasks.status, 'pending'))
    .orderBy(desc(unsubscribeTasks.createdAt));

  return c.json(result);
});

api.post('/unsubscribe/:id/complete', async (c) => {
  const taskId = parseInt(c.req.param('id'), 10);

  const task = await db.query.unsubscribeTasks.findFirst({
    where: eq(unsubscribeTasks.id, taskId),
  });

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  await db
    .update(unsubscribeTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(unsubscribeTasks.id, taskId));

  return c.json({ status: 'completed', taskId });
});

// Auto-unsubscribe a single task
api.post('/unsubscribe/:id/execute', async (c) => {
  const taskId = parseInt(c.req.param('id'), 10);

  const task = await db.query.unsubscribeTasks.findFirst({
    where: eq(unsubscribeTasks.id, taskId),
  });

  if (!task) {
    return c.json({ error: 'Task not found' }, 404);
  }

  const executor = new UnsubscribeExecutor();
  const result = await executor.execute(
    task.unsubscribeUrl,
    task.method as 'one-click' | 'link' | 'mailto'
  );

  // Update task status based on result
  await db
    .update(unsubscribeTasks)
    .set({
      status: result.success ? 'completed' : 'failed',
      completedAt: result.success ? new Date() : null,
    })
    .where(eq(unsubscribeTasks.id, taskId));

  return c.json({
    taskId,
    ...result,
  });
});

// Auto-unsubscribe all pending tasks
api.post('/unsubscribe/execute-all', async (c) => {
  const pendingTasks = await db
    .select()
    .from(unsubscribeTasks)
    .where(eq(unsubscribeTasks.status, 'pending'));

  if (pendingTasks.length === 0) {
    return c.json({ status: 'no_pending', message: 'No pending unsubscribe tasks' });
  }

  const executor = new UnsubscribeExecutor();
  const results: Array<{
    taskId: number;
    sender: string;
    success: boolean;
    explanation: string;
    nextAction?: string;
  }> = [];

  for (const task of pendingTasks) {
    const result = await executor.execute(
      task.unsubscribeUrl,
      task.method as 'one-click' | 'link' | 'mailto'
    );

    // Update task status
    await db
      .update(unsubscribeTasks)
      .set({
        status: result.success ? 'completed' : 'failed',
        completedAt: result.success ? new Date() : null,
      })
      .where(eq(unsubscribeTasks.id, task.id));

    results.push({
      taskId: task.id,
      sender: task.sender,
      success: result.success,
      explanation: result.explanation,
      nextAction: result.nextAction,
    });

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  const successCount = results.filter((r) => r.success).length;

  return c.json({
    status: 'completed',
    total: results.length,
    successful: successCount,
    failed: results.length - successCount,
    results,
  });
});

api.get('/scans', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);

  const result = await db.select().from(scanLogs).orderBy(desc(scanLogs.startedAt)).limit(limit);

  return c.json(result);
});

// Delete spam emails (move to trash)
api.post('/emails/trash-spam', async (c) => {
  const { getImapClient } = await import('../services/imap-client.js');
  const imapClient = getImapClient();

  // Get all spam emails that haven't been deleted yet
  const spamEmails = await db
    .select()
    .from(emails)
    .where(sql`${emails.classification} = 'spam' AND ${emails.deleted} = 0`);

  let trashedCount = 0;
  const errors: string[] = [];

  for (const email of spamEmails) {
    try {
      const success = await imapClient.moveToTrash(email.messageId);
      if (success) {
        await db.update(emails).set({ deleted: 1 }).where(eq(emails.id, email.id));
        trashedCount++;
      }
    } catch (error) {
      errors.push(`Failed to trash ${email.subject}: ${error}`);
    }
  }

  return c.json({
    status: 'completed',
    trashedCount,
    totalSpam: spamEmails.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});

// Delete a single email (move to trash)
api.post('/emails/:id/trash', async (c) => {
  const emailId = parseInt(c.req.param('id'), 10);

  const email = await db.query.emails.findFirst({
    where: eq(emails.id, emailId),
  });

  if (!email) {
    return c.json({ error: 'Email not found' }, 404);
  }

  if (email.deleted) {
    return c.json({ error: 'Email already trashed' }, 400);
  }

  const { getImapClient } = await import('../services/imap-client.js');
  const imapClient = getImapClient();

  try {
    const success = await imapClient.moveToTrash(email.messageId);
    if (success) {
      await db.update(emails).set({ deleted: 1 }).where(eq(emails.id, emailId));
      return c.json({ status: 'trashed', emailId });
    }
    return c.json({ error: 'Failed to move to trash' }, 500);
  } catch (error) {
    return c.json({ error: `Failed: ${error}` }, 500);
  }
});

// Settings endpoints
api.get('/settings', (c) => {
  const settings = getAllSettings();
  return c.json(settings);
});

api.put('/settings', async (c) => {
  const body = await c.req.json<Record<string, string>>();

  for (const [key, value] of Object.entries(body)) {
    setSetting(key, value);
  }

  // Update worker count if changed
  if ('worker_count' in body) {
    await queueManager.updateWorkerCount();
  }

  return c.json({ status: 'ok', updated: Object.keys(body) });
});

api.get('/settings/:key', (c) => {
  const key = c.req.param('key');
  const value = getSetting(key);
  if (value === null) {
    return c.json({ error: 'Setting not found' }, 404);
  }
  return c.json({ key, value });
});

api.put('/settings/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json<{ value: string }>();
  setSetting(key, body.value);

  if (key === 'worker_count') {
    await queueManager.updateWorkerCount();
  }

  return c.json({ status: 'ok', key, value: body.value });
});

// Queue endpoints
api.get('/queue/stats', (c) => {
  const stats = queueManager.getStats();
  return c.json(stats);
});

api.post('/queue/start', async (c) => {
  await queueManager.start();
  return c.json({ status: 'started' });
});

api.post('/queue/stop', async (c) => {
  await queueManager.stop();
  return c.json({ status: 'stopped' });
});

api.get('/queue/items', async (c) => {
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') ?? '50', 10);

  const result = status
    ? await db
        .select()
        .from(emailQueue)
        .where(eq(emailQueue.status, status as 'pending' | 'processing' | 'completed' | 'failed'))
        .orderBy(desc(emailQueue.createdAt))
        .limit(limit)
    : await db.select().from(emailQueue).orderBy(desc(emailQueue.createdAt)).limit(limit);

  return c.json(result);
});

api.delete('/queue/clear', async (c) => {
  const status = c.req.query('status') as 'completed' | 'failed' | undefined;

  if (status) {
    await db.delete(emailQueue).where(eq(emailQueue.status, status));
  } else {
    await db.delete(emailQueue).where(eq(emailQueue.status, 'completed'));
  }

  return c.json({ status: 'cleared' });
});

// Ollama ping/test connection
api.get('/ollama/ping', async (c) => {
  const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${host}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return c.json({
        connected: false,
        host,
        error: `HTTP ${response.status}: ${response.statusText}`,
      });
    }

    const data = (await response.json()) as { models?: unknown[] };
    return c.json({
      connected: true,
      host,
      modelCount: data.models?.length ?? 0,
      message: 'Connection successful',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide user-friendly error messages
    let friendlyError = errorMessage;
    if (errorMessage.includes('ECONNREFUSED')) {
      friendlyError = `Connection refused - Ollama may not be running at ${host}`;
    } else if (errorMessage.includes('EHOSTUNREACH') || errorMessage.includes('No route to host')) {
      friendlyError = `No route to host - Cannot reach ${host}. Check if the IP address is correct and the server is accessible.`;
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('abort')) {
      friendlyError = `Connection timed out - ${host} did not respond within 5 seconds`;
    } else if (errorMessage.includes('ENOTFOUND')) {
      friendlyError = `Host not found - ${host} could not be resolved`;
    }

    return c.json({
      connected: false,
      host,
      error: friendlyError,
      rawError: errorMessage,
    });
  }
});

// Ollama model management
api.get('/ollama/models', async (c) => {
  const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';

  try {
    const response = await fetch(`${host}/api/tags`);
    if (!response.ok) {
      return c.json({ error: 'Failed to fetch models' }, 500);
    }
    const data = (await response.json()) as {
      models: Array<{
        name: string;
        size: number;
        modified_at: string;
        digest: string;
        details?: { family: string; parameter_size: string; quantization_level: string };
      }>;
    };
    return c.json(data.models);
  } catch (error) {
    return c.json({ error: 'Could not connect to Ollama' }, 500);
  }
});

// Pull (download) a model
api.post('/ollama/models/pull', async (c) => {
  const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';
  const body = await c.req.json<{ name: string }>();

  if (!body.name) {
    return c.json({ error: 'Model name required' }, 400);
  }

  try {
    const response = await fetch(`${host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: body.name, stream: false }),
    });

    if (!response.ok) {
      const err = await response.text();
      return c.json({ error: `Failed to pull model: ${err}` }, 500);
    }

    const result = await response.json();
    return c.json({ status: 'success', result });
  } catch (error) {
    return c.json({ error: `Could not pull model: ${error instanceof Error ? error.message : 'Unknown'}` }, 500);
  }
});

// Stream pull progress (SSE)
api.get('/ollama/models/pull/stream', async (c) => {
  const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';
  const name = c.req.query('name');

  if (!name) {
    return c.json({ error: 'Model name required' }, 400);
  }

  try {
    const response = await fetch(`${host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!response.ok || !response.body) {
      return c.json({ error: 'Failed to start pull' }, 500);
    }

    // Return SSE stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return c.json({ error: `Could not pull model: ${error instanceof Error ? error.message : 'Unknown'}` }, 500);
  }
});

// Delete a model
api.delete('/ollama/models/:name', async (c) => {
  const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';
  const name = decodeURIComponent(c.req.param('name'));

  try {
    const response = await fetch(`${host}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const err = await response.text();
      return c.json({ error: `Failed to delete model: ${err}` }, 500);
    }

    return c.json({ status: 'deleted', name });
  } catch (error) {
    return c.json({ error: `Could not delete model: ${error instanceof Error ? error.message : 'Unknown'}` }, 500);
  }
});

// Get model info
api.get('/ollama/models/:name', async (c) => {
  const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';
  const name = decodeURIComponent(c.req.param('name'));

  try {
    const response = await fetch(`${host}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      return c.json({ error: 'Model not found' }, 404);
    }

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    return c.json({ error: 'Could not get model info' }, 500);
  }
});

// Get model-specific prompt (auto-selected based on model name)
api.get('/ollama/prompt/:model', (c) => {
  const model = c.req.param('model');
  const prompts = getPromptsForModel(model);
  return c.json({
    model,
    prompts,
    supportedModels: getSupportedModels(),
  });
});

// Get full model config (prompt + optimal settings)
api.get('/ollama/config/:model', (c) => {
  const model = c.req.param('model');
  const cfg = getConfigForModel(model);
  return c.json({
    model,
    prompt: cfg.prompts.single,
    batchPrompt: cfg.prompts.batch,
    workers: cfg.workers,
    batchSize: cfg.batchSize,
    concurrency: cfg.concurrency,
    description: cfg.description,
    speed: cfg.speed,
  });
});

// Get all model configs (for UI display)
api.get('/ollama/configs', (c) => {
  return c.json(getAllModelConfigs());
});

// Get supported model families
api.get('/ollama/supported-models', (c) => {
  return c.json({
    models: getSupportedModels(),
  });
});

// Test classification prompt
api.post('/ollama/test', async (c) => {
  const body = await c.req.json<{ fromAddr: string; subject: string; bodyPreview: string }>();
  const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';
  const model = getSetting('ollama_model') ?? 'qwen2.5:0.5b';
  const promptTemplate = getSetting('ollama_prompt') ?? '';

  const prompt = promptTemplate
    .replace('{fromAddr}', body.fromAddr)
    .replace('{subject}', body.subject)
    .replace('{bodyPreview}', body.bodyPreview);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for generation

    const response = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      return c.json({
        error: `Ollama request failed (HTTP ${response.status})`,
        details: errText,
        host,
        model,
      });
    }

    const result = (await response.json()) as { response?: string };
    let parsed = null;
    try {
      parsed = JSON.parse(result.response ?? '{}');
    } catch {
      // JSON parse failed, return raw only
    }
    return c.json({ raw: result.response, parsed, host, model });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide user-friendly error messages
    let friendlyError = errorMessage;
    if (errorMessage.includes('ECONNREFUSED')) {
      friendlyError = `Connection refused - Ollama may not be running at ${host}`;
    } else if (errorMessage.includes('EHOSTUNREACH') || errorMessage.includes('No route to host')) {
      friendlyError = `No route to host - Cannot reach ${host}. Check if the IP address is correct.`;
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('abort')) {
      friendlyError = `Connection timed out - Request to ${host} did not complete in time`;
    } else if (errorMessage.includes('ENOTFOUND')) {
      friendlyError = `Host not found - ${host} could not be resolved`;
    }

    return c.json({
      error: friendlyError,
      rawError: errorMessage,
      host,
      model,
    });
  }
});

// ==================== IMAP Configuration ====================
import { testImapConnection, IMAP_PROVIDERS, importAllEmails } from '../services/imap-client.js';
import type { ImportStatus } from '../types.js';

// Get IMAP providers list
api.get('/imap/providers', (c) => {
  const providers = Object.entries(IMAP_PROVIDERS).map(([key, value]) => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    host: value.host,
    port: value.port,
  }));
  return c.json(providers);
});

// Get IMAP configuration status
api.get('/imap/config', (c) => {
  return c.json({
    configured: getSetting('imap_configured') === 'true',
    provider: getSetting('imap_provider') || '',
    host: getSetting('imap_host') || '',
    port: parseInt(getSetting('imap_port') || '993', 10),
    user: getSetting('imap_user') || '',
    // Don't send password back
    hasPassword: !!getSetting('imap_password'),
  });
});

// Test IMAP connection
api.post('/imap/test', async (c) => {
  const body = await c.req.json<{
    provider: string;
    host: string;
    port: number;
    user: string;
    password: string;
  }>();

  const result = await testImapConnection(body);
  return c.json(result);
});

// Save IMAP configuration
api.post('/imap/config', async (c) => {
  const body = await c.req.json<{
    provider: string;
    host: string;
    port: number;
    user: string;
    password: string;
  }>();

  setSetting('imap_provider', body.provider);
  setSetting('imap_host', body.host);
  setSetting('imap_port', String(body.port));
  setSetting('imap_user', body.user);
  setSetting('imap_password', body.password);
  setSetting('imap_configured', 'true');

  return c.json({ status: 'saved' });
});

// Reset IMAP configuration (use mock data)
api.delete('/imap/config', (c) => {
  setSetting('imap_configured', 'false');
  setSetting('imap_provider', '');
  setSetting('imap_host', '');
  setSetting('imap_user', '');
  setSetting('imap_password', '');
  return c.json({ status: 'reset' });
});

// ==================== Scan Status (SSE) ====================
// Global scan status for real-time updates
let currentScanStatus: {
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
} = { active: false, phase: 'idle', current: 0, total: 0 };

export function updateScanStatus(status: typeof currentScanStatus) {
  currentScanStatus = status;
}

api.get('/scan/status', (c) => {
  return c.json(currentScanStatus);
});

// ==================== Email Import ====================
// Global import status for real-time updates
let currentImportStatus: ImportStatus = {
  active: false,
  phase: 'idle',
  currentFolder: '',
  foldersProcessed: 0,
  totalFolders: 0,
  emailsFound: 0,
  emailsImported: 0,
  duplicatesSkipped: 0,
};

api.get('/import/status', (c) => {
  return c.json(currentImportStatus);
});

api.post('/import', async (c) => {
  if (currentImportStatus.active) {
    return c.json({ error: 'Import already in progress' }, 400);
  }

  // Start import in background
  (async () => {
    try {
      const allEmails = await importAllEmails((status) => {
        currentImportStatus = status;
      });

      // Insert emails into database (deduplicate by message_id)
      let dbImported = 0;
      let dbSkipped = 0;

      for (const email of allEmails) {
        const existing = await db.query.emails.findFirst({
          where: eq(emails.messageId, email.messageId),
        });

        if (existing) {
          dbSkipped++;
          continue;
        }

        await db.insert(emails).values({
          messageId: email.messageId,
          fromAddr: email.fromAddr,
          subject: email.subject,
          bodyPreview: email.body,
          date: email.date,
          classification: 'unknown',
          confidence: 0,
          processedAt: new Date(),
          deleted: 0,
        });
        dbImported++;
      }

      currentImportStatus = {
        active: false,
        phase: 'Complete',
        currentFolder: '',
        foldersProcessed: currentImportStatus.totalFolders,
        totalFolders: currentImportStatus.totalFolders,
        emailsFound: currentImportStatus.emailsFound,
        emailsImported: dbImported,
        duplicatesSkipped: currentImportStatus.duplicatesSkipped + dbSkipped,
      };
    } catch (error) {
      currentImportStatus = {
        ...currentImportStatus,
        active: false,
        phase: 'Error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  })();

  return c.json({ status: 'started' });
});
