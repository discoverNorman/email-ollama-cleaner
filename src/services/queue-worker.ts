import { eq, and, isNull, sql } from 'drizzle-orm';
import { db, getSetting } from '../db/index.js';
import { emails, emailQueue, unsubscribeTasks } from '../db/schema.js';
import type { Classification, OllamaClassification } from '../types.js';
import { extractUnsubscribeInfo } from './unsubscribe.js';

interface WorkerState {
  id: string;
  running: boolean;
  currentItem: number | null;
  processedCount: number;
  startedAt: Date | null;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  workers: WorkerState[];
}

class QueueWorkerManager {
  private workers: Map<string, WorkerState> = new Map();
  private workerIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    const workerCount = parseInt(getSetting('worker_count') ?? '1', 10);
    console.log(`Starting ${workerCount} queue worker(s)`);

    for (let i = 0; i < workerCount; i++) {
      this.startWorker(`worker-${i}`);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    for (const [id, interval] of this.workerIntervals) {
      clearInterval(interval);
      this.workerIntervals.delete(id);
    }
    this.workers.clear();
    console.log('Queue workers stopped');
  }

  async updateWorkerCount(): Promise<void> {
    const targetCount = parseInt(getSetting('worker_count') ?? '1', 10);
    const currentCount = this.workers.size;

    if (targetCount > currentCount) {
      for (let i = currentCount; i < targetCount; i++) {
        this.startWorker(`worker-${i}`);
      }
    } else if (targetCount < currentCount) {
      const workersToRemove = Array.from(this.workers.keys()).slice(targetCount);
      for (const id of workersToRemove) {
        this.stopWorker(id);
      }
    }
  }

  private startWorker(id: string): void {
    const state: WorkerState = {
      id,
      running: true,
      currentItem: null,
      processedCount: 0,
      startedAt: new Date(),
    };
    this.workers.set(id, state);

    const interval = setInterval(() => this.processNextItem(id), 1000);
    this.workerIntervals.set(id, interval);
    console.log(`Worker ${id} started`);
  }

  private stopWorker(id: string): void {
    const interval = this.workerIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.workerIntervals.delete(id);
    }
    this.workers.delete(id);
    console.log(`Worker ${id} stopped`);
  }

  private async processNextItem(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker || !worker.running) return;

    const queueEnabled = getSetting('queue_enabled') === 'true';
    if (!queueEnabled) return;

    try {
      // Claim a pending item
      const item = await db
        .update(emailQueue)
        .set({
          status: 'processing',
          workerId,
          startedAt: new Date(),
        })
        .where(and(eq(emailQueue.status, 'pending'), isNull(emailQueue.workerId)))
        .returning();

      if (item.length === 0) return;

      const queueItem = item[0];
      worker.currentItem = queueItem.id;

      // Process the email
      const result = await this.classifyEmail(queueItem);

      // Save result
      await db
        .update(emailQueue)
        .set({
          status: 'completed',
          completedAt: new Date(),
          result: JSON.stringify(result),
        })
        .where(eq(emailQueue.id, queueItem.id));

      // Create email record
      const [emailRecord] = await db
        .insert(emails)
        .values({
          messageId: queueItem.messageId,
          fromAddr: queueItem.fromAddr,
          subject: queueItem.subject,
          bodyPreview: queueItem.bodyPreview?.slice(0, 200),
          date: queueItem.emailDate,
          classification: result.classification,
          confidence: result.confidence,
          processedAt: new Date(),
          deleted: result.classification === 'spam' ? 1 : 0,
        })
        .onConflictDoNothing()
        .returning();

      // Handle newsletter unsubscribe
      if (emailRecord && result.classification === 'newsletter' && queueItem.headers) {
        const headers = JSON.parse(queueItem.headers) as Record<string, string>;
        const unsubInfo = extractUnsubscribeInfo(headers, queueItem.bodyPreview ?? '');
        if (unsubInfo.url) {
          await db.insert(unsubscribeTasks).values({
            emailId: emailRecord.id,
            sender: queueItem.fromAddr,
            unsubscribeUrl: unsubInfo.url,
            method: unsubInfo.method,
            status: 'pending',
            createdAt: new Date(),
          });
        }
      }

      worker.processedCount++;
      worker.currentItem = null;
    } catch (error) {
      console.error(`Worker ${workerId} error:`, error);
      worker.currentItem = null;
    }
  }

  private async classifyEmail(item: {
    fromAddr: string;
    subject: string;
    bodyPreview: string | null;
  }): Promise<OllamaClassification> {
    const host = getSetting('ollama_host') ?? 'http://192.168.1.207:11434';
    const model = getSetting('ollama_model') ?? 'qwen2.5:0.5b';
    const promptTemplate = getSetting('ollama_prompt') ?? '';

    const prompt = promptTemplate
      .replace('{fromAddr}', item.fromAddr)
      .replace('{subject}', item.subject)
      .replace('{bodyPreview}', (item.bodyPreview ?? '').slice(0, 500));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

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

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status}`);
      }

      const result = (await response.json()) as { response?: string };
      const text = result.response ?? '{}';
      const parsed = JSON.parse(text) as { classification?: string; confidence?: number; reasoning?: string };

      const classificationMap: Record<string, Classification> = {
        spam: 'spam',
        newsletter: 'newsletter',
        keep: 'keep',
        legitimate: 'keep',
      };

      return {
        classification: classificationMap[parsed.classification?.toLowerCase() ?? ''] ?? 'unknown',
        confidence: parsed.confidence ?? 0.5,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.error('Classification error:', error);
      return {
        classification: 'unknown',
        confidence: 0,
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  getStats(): QueueStats {
    const workers = Array.from(this.workers.values());

    // Get queue counts synchronously using raw SQL
    const counts = db
      .select({
        status: emailQueue.status,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(emailQueue)
      .groupBy(emailQueue.status)
      .all();

    const countMap: Record<string, number> = {};
    for (const row of counts) {
      countMap[row.status ?? 'unknown'] = row.count;
    }

    return {
      pending: countMap['pending'] ?? 0,
      processing: countMap['processing'] ?? 0,
      completed: countMap['completed'] ?? 0,
      failed: countMap['failed'] ?? 0,
      workers,
    };
  }

  isActive(): boolean {
    return this.isRunning;
  }
}

export const queueManager = new QueueWorkerManager();
