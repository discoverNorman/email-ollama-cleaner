import { eq, inArray } from 'drizzle-orm';
import { db, getSetting } from '../db/index.js';
import { emails, unsubscribeTasks, scanLogs, emailQueue } from '../db/schema.js';
import type { ScanStats } from '../types.js';
import { getImapClient, type IMAPClient } from './imap-client.js';
import { OllamaClient } from './ollama-client.js';
import { extractUnsubscribeInfo } from './unsubscribe.js';
import { updateScanStatus } from '../routes/api.js';

export class EmailProcessor {
  private imapClient: IMAPClient;
  private ollamaClient: OllamaClient;

  constructor() {
    this.imapClient = getImapClient();
    this.ollamaClient = new OllamaClient();
  }

  async processEmails(limit: number = 50): Promise<ScanStats> {
    const queueEnabled = getSetting('queue_enabled') === 'true';

    if (queueEnabled) {
      return this.queueEmails(limit);
    } else {
      return this.processEmailsDirect(limit);
    }
  }

  // Queue emails for worker processing
  private async queueEmails(limit: number): Promise<ScanStats> {
    updateScanStatus({ active: true, phase: 'Starting scan...', current: 0, total: 0 });

    const [scanLog] = await db
      .insert(scanLogs)
      .values({
        startedAt: new Date(),
      })
      .returning();

    const stats: ScanStats = {
      emailsProcessed: 0,
      spamCount: 0,
      newsletterCount: 0,
      keepCount: 0,
    };

    updateScanStatus({ active: true, phase: 'Fetching emails from server...', current: 0, total: 0 });
    const emailMessages = await this.imapClient.fetchEmails(limit);
    const total = emailMessages.length;

    updateScanStatus({ active: true, phase: 'Processing emails...', current: 0, total });

    for (let i = 0; i < emailMessages.length; i++) {
      const emailMsg = emailMessages[i];

      updateScanStatus({
        active: true,
        phase: 'Queueing emails...',
        current: i + 1,
        total,
        currentEmail: emailMsg.subject?.slice(0, 50),
      });

      // Check if already processed or queued
      const existingEmail = await db.query.emails.findFirst({
        where: eq(emails.messageId, emailMsg.messageId),
      });

      if (existingEmail) continue;

      const existingQueue = await db.query.emailQueue.findFirst({
        where: eq(emailQueue.messageId, emailMsg.messageId),
      });

      if (existingQueue) continue;

      // Add to queue
      await db.insert(emailQueue).values({
        messageId: emailMsg.messageId,
        fromAddr: emailMsg.fromAddr,
        subject: emailMsg.subject,
        bodyPreview: emailMsg.body.slice(0, 500),
        emailDate: emailMsg.date,
        headers: JSON.stringify(emailMsg.headers),
        status: 'pending',
        createdAt: new Date(),
      });

      stats.emailsProcessed++;
    }

    await db
      .update(scanLogs)
      .set({
        completedAt: new Date(),
        emailsProcessed: stats.emailsProcessed,
      })
      .where(eq(scanLogs.id, scanLog.id));

    updateScanStatus({ active: false, phase: 'Complete', current: total, total });
    return stats;
  }

  // Direct processing (legacy mode when queue disabled)
  private async processEmailsDirect(limit: number): Promise<ScanStats> {
    updateScanStatus({ active: true, phase: 'Starting scan...', current: 0, total: 0 });

    const [scanLog] = await db
      .insert(scanLogs)
      .values({
        startedAt: new Date(),
      })
      .returning();

    const stats: ScanStats = {
      emailsProcessed: 0,
      spamCount: 0,
      newsletterCount: 0,
      keepCount: 0,
    };

    updateScanStatus({ active: true, phase: 'Fetching emails from server...', current: 0, total: 0 });
    const emailMessages = await this.imapClient.fetchEmails(limit);
    const total = emailMessages.length;

    updateScanStatus({ active: true, phase: 'Classifying emails...', current: 0, total });

    for (let i = 0; i < emailMessages.length; i++) {
      const emailMsg = emailMessages[i];

      updateScanStatus({
        active: true,
        phase: 'Classifying with AI...',
        current: i + 1,
        total,
        currentEmail: emailMsg.subject?.slice(0, 50),
      });

      const existing = await db.query.emails.findFirst({
        where: eq(emails.messageId, emailMsg.messageId),
      });

      if (existing) {
        continue;
      }

      const classification = await this.ollamaClient.classifyEmail(
        emailMsg.fromAddr,
        emailMsg.subject,
        emailMsg.body.slice(0, 500)
      );

      const [emailRecord] = await db
        .insert(emails)
        .values({
          messageId: emailMsg.messageId,
          fromAddr: emailMsg.fromAddr,
          subject: emailMsg.subject,
          bodyPreview: emailMsg.body.slice(0, 200),
          date: emailMsg.date,
          classification: classification.classification,
          confidence: classification.confidence,
          processedAt: new Date(),
        })
        .returning();

      stats.emailsProcessed++;

      if (classification.classification === 'spam') {
        stats.spamCount++;
        // Don't auto-delete - user must confirm in UI
      } else if (classification.classification === 'newsletter') {
        stats.newsletterCount++;
        const unsubInfo = extractUnsubscribeInfo(emailMsg.headers, emailMsg.body);
        if (unsubInfo.url) {
          await db.insert(unsubscribeTasks).values({
            emailId: emailRecord.id,
            sender: emailMsg.fromAddr,
            unsubscribeUrl: unsubInfo.url,
            method: unsubInfo.method,
            status: 'pending',
            createdAt: new Date(),
          });
        }
      } else {
        stats.keepCount++;
      }
    }

    await db
      .update(scanLogs)
      .set({
        completedAt: new Date(),
        emailsProcessed: stats.emailsProcessed,
        spamCount: stats.spamCount,
        newsletterCount: stats.newsletterCount,
        keepCount: stats.keepCount,
      })
      .where(eq(scanLogs.id, scanLog.id));

    updateScanStatus({ active: false, phase: 'Complete', current: total, total });
    return stats;
  }

  // Classify existing database emails by their IDs with parallel processing
  async classifyByIds(emailIds: number[]): Promise<ScanStats> {
    updateScanStatus({ active: true, phase: 'Starting classification...', current: 0, total: 0 });

    const [scanLog] = await db
      .insert(scanLogs)
      .values({
        startedAt: new Date(),
      })
      .returning();

    const stats: ScanStats = {
      emailsProcessed: 0,
      spamCount: 0,
      newsletterCount: 0,
      keepCount: 0,
    };

    // Fetch emails from database
    const emailRecords = await db.select().from(emails).where(inArray(emails.id, emailIds));

    // Create a map for quick lookup and maintain order
    const emailMap = new Map(emailRecords.map(e => [e.id, e]));
    const orderedEmails = emailIds.map(id => emailMap.get(id)).filter(Boolean);

    // Filter to only unclassified emails
    const toClassify = orderedEmails.filter(e => e!.classification === 'unknown');
    const total = toClassify.length;

    if (total === 0) {
      updateScanStatus({ active: false, phase: 'No emails to classify', current: 0, total: 0 });
      return stats;
    }

    const startTime = Date.now();
    let completed = 0;
    let concurrency = 12; // Start with 12 parallel requests, scale to 16
    let consecutiveErrors = 0;
    let currentEmailSubject = '';
    let currentEmailFrom = '';
    let currentEmailId: number | undefined;

    const EMAILS_PER_BATCH = 8;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const avgTimePerEmail = completed > 0 ? elapsed / completed : 0;
      const emailsPerRound = concurrency * EMAILS_PER_BATCH;
      updateScanStatus({
        active: true,
        phase: `Batch: ${EMAILS_PER_BATCH}x${concurrency} = ${emailsPerRound}/round`,
        current: completed,
        total,
        currentEmail: currentEmailSubject,
        currentEmailFrom,
        currentEmailId,
        startTime,
        avgTimePerEmail,
        concurrency,
      });
    };

    updateScanStatus({ active: true, phase: 'Starting batch classification...', current: 0, total, startTime, concurrency });

    // Process emails using batch classification for speed
    // Each Ollama request handles 5 emails, run multiple batch requests in parallel
    let index = 0;

    while (index < toClassify.length) {
      // Calculate how many parallel batch requests to run
      const remainingEmails = toClassify.length - index;
      const numBatches = Math.min(concurrency, Math.ceil(remainingEmails / EMAILS_PER_BATCH));

      // Create batch groups
      const batchGroups: typeof toClassify[] = [];
      for (let b = 0; b < numBatches; b++) {
        const start = index + b * EMAILS_PER_BATCH;
        const end = Math.min(start + EMAILS_PER_BATCH, toClassify.length);
        if (start < toClassify.length) {
          batchGroups.push(toClassify.slice(start, end));
        }
      }

      // Update status with first email
      const firstEmail = batchGroups[0]?.[0];
      currentEmailSubject = firstEmail?.subject?.slice(0, 60) ?? '';
      currentEmailFrom = firstEmail?.fromAddr ?? '';
      currentEmailId = firstEmail?.id;
      updateProgress();

      // Run batch requests in parallel
      const batchResults = await Promise.allSettled(
        batchGroups.map(async (batchEmails) => {
          const emailsForBatch = batchEmails.map((e) => ({
            fromAddr: e!.fromAddr,
            subject: e!.subject ?? '',
            bodyPreview: e!.bodyPreview ?? '',
          }));

          const classifications = await this.ollamaClient.classifyEmailBatch(emailsForBatch);

          // Update database for each email in batch
          for (let i = 0; i < batchEmails.length; i++) {
            const emailRecord = batchEmails[i]!;
            const classification = classifications[i];

            await db
              .update(emails)
              .set({
                classification: classification.classification,
                confidence: classification.confidence,
                processedAt: new Date(),
              })
              .where(eq(emails.id, emailRecord.id));
          }

          return classifications;
        })
      );

      // Process results and adjust concurrency based on errors
      let batchErrors = 0;
      let emailsInThisRound = 0;

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          consecutiveErrors = 0;
          for (const classification of result.value) {
            stats.emailsProcessed++;
            emailsInThisRound++;
            if (classification.classification === 'spam') {
              stats.spamCount++;
            } else if (classification.classification === 'newsletter') {
              stats.newsletterCount++;
            } else if (classification.classification === 'keep') {
              stats.keepCount++;
            }
          }
        } else {
          batchErrors++;
          consecutiveErrors++;
          console.error('Batch classification error:', result.reason);
        }
      }

      completed += emailsInThisRound;
      index += numBatches * EMAILS_PER_BATCH;
      updateProgress();

      // Adjust concurrency based on errors
      if (batchErrors > 0) {
        concurrency = Math.max(1, Math.floor(concurrency / 2));
        console.log(`Errors detected, reducing concurrency to ${concurrency}`);
        await new Promise(r => setTimeout(r, 500));
      } else if (consecutiveErrors === 0 && concurrency < 16) {
        concurrency = Math.min(16, concurrency + 2);
      }
    }

    await db
      .update(scanLogs)
      .set({
        completedAt: new Date(),
        emailsProcessed: stats.emailsProcessed,
        spamCount: stats.spamCount,
        newsletterCount: stats.newsletterCount,
        keepCount: stats.keepCount,
      })
      .where(eq(scanLogs.id, scanLog.id));

    updateScanStatus({ active: false, phase: 'Complete', current: total, total });
    return stats;
  }
}
