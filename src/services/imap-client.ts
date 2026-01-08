import { config } from '../config.js';
import type { EmailMessage, ImportStatus } from '../types.js';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { getSetting } from '../db/index.js';

// IMAP provider presets
export const IMAP_PROVIDERS: Record<string, { host: string; port: number; trash: string }> = {
  gmail: { host: 'imap.gmail.com', port: 993, trash: '[Gmail]/Trash' },
  outlook: { host: 'outlook.office365.com', port: 993, trash: 'Deleted Items' },
  yahoo: { host: 'imap.mail.yahoo.com', port: 993, trash: 'Trash' },
  icloud: { host: 'imap.mail.me.com', port: 993, trash: 'Deleted Messages' },
  custom: { host: '', port: 993, trash: 'Trash' },
};

const MOCK_SPAM_EMAILS = [
  {
    from: 'winner@lottery-intl.com',
    subject: 'YOU WON $5,000,000!!! Claim Now!!!',
    body: 'Congratulations! You have been selected as winner of our international lottery. Send your bank details to claim your prize immediately!',
  },
  {
    from: 'prince.abubakar@nigeria-royal.net',
    subject: 'Urgent Business Proposal - $15M Transfer',
    body: 'Dear friend, I am Prince Abubakar and I need your help transferring $15 million out of my country. You will receive 30% commission.',
  },
  {
    from: 'security@paypa1-verify.com',
    subject: 'Your Account Has Been Limited - Action Required',
    body: 'We noticed unusual activity on your account. Click here to verify your identity or your account will be suspended in 24 hours.',
  },
  {
    from: 'invoice@quickbooks-billing.net',
    subject: 'Invoice #INV-29481 Due Immediately',
    body: 'Please find attached invoice for $3,299.00. Payment is overdue. Click to view and pay now to avoid late fees.',
  },
  {
    from: 'admin@amaz0n-security.com',
    subject: 'Suspicious Login Detected - Verify Now',
    body: 'Someone tried to access your Amazon account from Russia. Click here immediately to secure your account.',
  },
  {
    from: 'deals@cheap-rx-meds.com',
    subject: '80% OFF All Medications - No Prescription Needed',
    body: 'Get Viagra, Cialis, and more at unbeatable prices. No prescription required. Fast discreet shipping.',
  },
  {
    from: 'crypto@bitcoin-multiply.io',
    subject: 'Double Your Bitcoin in 24 Hours - Guaranteed!',
    body: 'Our AI trading bot guarantees 100% returns. Send 1 BTC and receive 2 BTC within 24 hours. Limited spots available!',
  },
  {
    from: 'hr@remote-jobs-elite.com',
    subject: 'Work From Home - Earn $5000/Week',
    body: 'No experience needed! Make thousands weekly from home. Just send $99 processing fee to get started.',
  },
  {
    from: 'support@netfl1x-billing.com',
    subject: 'Payment Failed - Update Card Now',
    body: 'Your Netflix subscription payment failed. Update your payment method within 48 hours or lose access.',
  },
  {
    from: 'warranty@extended-auto-coverage.com',
    subject: 'FINAL NOTICE: Your Vehicle Warranty Expires Tomorrow',
    body: 'This is your last chance to extend your vehicle warranty. Call now to avoid expensive repair bills.',
  },
];

const MOCK_NEWSLETTER_EMAILS = [
  {
    from: 'newsletter@techcrunch.com',
    subject: 'TechCrunch Daily: AI Startups Raise Record Funding',
    body: "Today's top stories: OpenAI competitors raise $2B, Apple announces new M4 chips, and more tech news...",
    unsubscribe: 'https://techcrunch.com/unsubscribe?id=12345',
  },
  {
    from: 'digest@medium.com',
    subject: 'Your Daily Read: Top Stories on Medium',
    body: "Based on your interests: 'How I Built a SaaS in 30 Days', 'The Future of Remote Work', and more...",
    unsubscribe: 'https://medium.com/unsubscribe',
  },
  {
    from: 'deals@amazon.com',
    subject: 'Lightning Deals: Up to 70% Off Electronics',
    body: 'Today only: Samsung TVs, Apple AirPods, Bose speakers and more at unbeatable prices. Prime members get early access.',
    unsubscribe: 'https://amazon.com/gp/unsubscribe',
  },
  {
    from: 'noreply@linkedin.com',
    subject: '5 People Viewed Your Profile This Week',
    body: "See who's been checking out your profile. Plus: 10 jobs that match your skills in Software Engineering.",
    unsubscribe: 'https://linkedin.com/comm/unsubscribe',
  },
  {
    from: 'hello@substack.com',
    subject: 'New Post from The Pragmatic Engineer',
    body: "Gergely Orosz published: 'Inside Big Tech Layoffs: What Really Happens'. Read the full post...",
    unsubscribe: 'https://substack.com/unsubscribe',
  },
  {
    from: 'promo@bestbuy.com',
    subject: 'Member Exclusive: Extra 15% Off This Weekend',
    body: 'As a valued member, enjoy an extra 15% off all purchases this weekend. Use code MEMBER15 at checkout.',
    unsubscribe: 'https://bestbuy.com/unsubscribe',
  },
  {
    from: 'news@github.com',
    subject: 'GitHub Explore: Trending Repositories This Week',
    body: "Check out what's trending: rust-lang/rust, microsoft/vscode, and 10 other repos you might like.",
    unsubscribe: 'https://github.com/settings/emails',
  },
  {
    from: 'weekly@spotify.com',
    subject: 'Your Discover Weekly is Ready',
    body: '30 fresh tracks picked just for you based on your listening history. Start listening now!',
    unsubscribe: 'https://spotify.com/account/notifications',
  },
];

const MOCK_LEGITIMATE_EMAILS = [
  {
    from: 'john.smith@company.com',
    subject: 'Re: Q4 Planning Meeting',
    body: "Thanks for setting this up. I'll bring the revenue projections. Can we also discuss the new hire timeline?",
  },
  {
    from: 'noreply@github.com',
    subject: '[repo-name] Pull Request #142: Fix authentication bug',
    body: 'sarah-dev opened a pull request: This PR fixes the JWT validation issue reported in #138. Please review.',
  },
  {
    from: 'receipts@uber.com',
    subject: 'Your Uber receipt from January 5',
    body: 'Trip from Downtown to Airport. Total: $32.50. Thank you for riding with Uber.',
  },
  {
    from: 'no-reply@stripe.com',
    subject: 'Payment successful for Invoice #1234',
    body: 'Your payment of $99.00 to SaaS Company has been processed successfully. View receipt in dashboard.',
  },
  {
    from: 'mom@gmail.com',
    subject: 'Dinner on Sunday?',
    body: 'Hi honey, are you free for dinner this Sunday? Dad wants to fire up the grill. Let me know!',
  },
  {
    from: 'noreply@google.com',
    subject: 'Security alert: New sign-in from Chrome on Mac',
    body: "We noticed a new sign-in to your Google Account. If this was you, you don't need to do anything.",
  },
  {
    from: 'orders@apple.com',
    subject: 'Your order has shipped',
    body: 'Good news! Your MacBook Pro is on its way. Expected delivery: January 8. Track your package.',
  },
  {
    from: 'calendar@google.com',
    subject: 'Reminder: Team Standup in 15 minutes',
    body: 'Team Standup - Monday Jan 6, 9:00 AM. Join with Google Meet: meet.google.com/abc-defg-hij',
  },
  {
    from: 'dentist@smileclinic.com',
    subject: 'Appointment Confirmation: Jan 10 at 2:00 PM',
    body: 'This confirms your cleaning appointment on January 10 at 2:00 PM. Please arrive 10 minutes early.',
  },
  {
    from: 'bank@chase.com',
    subject: 'Your statement is ready',
    body: 'Your January statement for account ending in 4523 is now available. Log in to view your statement.',
  },
  {
    from: 'landlord@propertymanagement.com',
    subject: 'Rent Receipt for January 2024',
    body: 'This confirms receipt of your rent payment of $2,100.00 for January 2024. Thank you!',
  },
  {
    from: 'coworker@company.com',
    subject: 'Quick question about the API',
    body: "Hey, do you know if we're supposed to use v2 or v3 of the payments API for the new feature? Thanks!",
  },
];

export interface IMAPClient {
  fetchEmails(limit?: number): Promise<EmailMessage[]>;
  moveToTrash(messageId: string): Promise<boolean>;
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function randomDate(daysBack: number = 7): Date {
  const now = new Date();
  const daysAgo = Math.random() * daysBack;
  const hoursAgo = Math.random() * 24;
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - hoursAgo * 60 * 60 * 1000);
}

class MockIMAPClient implements IMAPClient {
  private emails: EmailMessage[] = [];

  constructor() {
    this.generateMockEmails();
  }

  private generateMockEmails(): void {
    for (const spam of MOCK_SPAM_EMAILS) {
      this.emails.push({
        messageId: `spam-${randomId()}`,
        fromAddr: spam.from,
        subject: spam.subject,
        body: spam.body,
        date: randomDate(),
        headers: {},
      });
    }

    for (const newsletter of MOCK_NEWSLETTER_EMAILS) {
      const headers: Record<string, string> = {};
      if (newsletter.unsubscribe) {
        headers['List-Unsubscribe'] = `<${newsletter.unsubscribe}>`;
      }
      this.emails.push({
        messageId: `newsletter-${randomId()}`,
        fromAddr: newsletter.from,
        subject: newsletter.subject,
        body: newsletter.body,
        date: randomDate(),
        headers,
      });
    }

    for (const legit of MOCK_LEGITIMATE_EMAILS) {
      this.emails.push({
        messageId: `legit-${randomId()}`,
        fromAddr: legit.from,
        subject: legit.subject,
        body: legit.body,
        date: randomDate(),
        headers: {},
      });
    }

    this.emails.sort(() => Math.random() - 0.5);
  }

  async fetchEmails(limit: number = 50): Promise<EmailMessage[]> {
    return this.emails.slice(0, limit);
  }

  async moveToTrash(messageId: string): Promise<boolean> {
    this.emails = this.emails.filter((e) => e.messageId !== messageId);
    return true;
  }
}

class RealIMAPClient implements IMAPClient {
  private email: string;
  private password: string;
  private host: string;
  private port: number;
  private trashFolder: string;

  constructor(email: string, password: string, host: string, port: number, trashFolder: string) {
    this.email = email;
    this.password = password;
    this.host = host;
    this.port = port;
    this.trashFolder = trashFolder;
  }

  private async getClient(): Promise<ImapFlow> {
    const client = new ImapFlow({
      host: this.host,
      port: this.port,
      secure: true,
      auth: {
        user: this.email,
        pass: this.password,
      },
      logger: false,
    });
    await client.connect();
    return client;
  }

  async fetchEmails(limit: number = 50): Promise<EmailMessage[]> {
    const client = await this.getClient();
    const emails: EmailMessage[] = [];

    try {
      await client.mailboxOpen('INBOX');

      // Get the most recent emails
      const messages = client.fetch(`1:${limit}`, {
        envelope: true,
        source: true,
        uid: true,
      }, { changedSince: 0n });

      for await (const message of messages) {
        try {
          if (!message.source) continue;

          const parsed = await simpleParser(message.source);

          const fromAddr = parsed.from?.value?.[0]?.address ||
                          message.envelope?.from?.[0]?.address ||
                          'unknown';

          const headers: Record<string, string> = {};

          // Extract List-Unsubscribe header
          const unsubscribe = parsed.headers.get('list-unsubscribe');
          if (unsubscribe) {
            headers['List-Unsubscribe'] = String(unsubscribe);
          }

          // Get body preview (first 500 chars of text)
          let bodyPreview = '';
          if (parsed.text) {
            bodyPreview = parsed.text.substring(0, 500);
          } else if (parsed.html) {
            // Strip HTML tags for preview
            bodyPreview = parsed.html.replace(/<[^>]*>/g, '').substring(0, 500);
          }

          emails.push({
            messageId: message.envelope?.messageId || `uid-${message.uid}`,
            fromAddr,
            subject: parsed.subject || message.envelope?.subject || '(no subject)',
            body: bodyPreview,
            date: parsed.date || message.envelope?.date || new Date(),
            headers,
          });
        } catch (parseError) {
          console.error('Error parsing email:', parseError);
        }
      }

      // Sort by date, newest first
      emails.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    } finally {
      await client.logout();
    }

    return emails.slice(0, limit);
  }

  async moveToTrash(messageId: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      await client.mailboxOpen('INBOX');

      // Search for the message by Message-ID
      const results = await client.search({ header: { 'Message-ID': messageId } });

      if (!results || (Array.isArray(results) && results.length === 0)) {
        console.warn(`Message not found: ${messageId}`);
        return false;
      }

      // Move to trash folder (varies by provider)
      await client.messageMove(results as number[], this.trashFolder);
      return true;

    } finally {
      await client.logout();
    }
  }
}

export function getImapClient(): IMAPClient {
  const imapConfigured = getSetting('imap_configured') === 'true';

  if (!imapConfigured || config.app.useMockImap) {
    return new MockIMAPClient();
  }

  const provider = getSetting('imap_provider') || 'custom';
  const providerConfig = IMAP_PROVIDERS[provider] || IMAP_PROVIDERS.custom;

  const host = getSetting('imap_host') || providerConfig.host;
  const port = parseInt(getSetting('imap_port') || String(providerConfig.port), 10);
  const user = getSetting('imap_user') || '';
  const password = getSetting('imap_password') || '';
  const trashFolder = providerConfig.trash;

  return new RealIMAPClient(user, password, host, port, trashFolder);
}

// Test IMAP connection with provided settings
export async function testImapConnection(settings: {
  provider: string;
  host: string;
  port: number;
  user: string;
  password: string;
}): Promise<{ success: boolean; error?: string; mailboxCount?: number }> {
  try {
    const providerConfig = IMAP_PROVIDERS[settings.provider] || IMAP_PROVIDERS.custom;
    const host = settings.host || providerConfig.host;
    const port = settings.port || providerConfig.port;

    const client = new ImapFlow({
      host,
      port,
      secure: true,
      auth: {
        user: settings.user,
        pass: settings.password,
      },
      logger: false,
    });

    await client.connect();

    // Get mailbox list to verify connection
    const mailboxes = await client.list();
    const mailboxCount = mailboxes.length;

    await client.logout();

    return { success: true, mailboxCount };
  } catch (error: any) {
    let errorMessage = error.message || 'Unknown error';

    // Provide user-friendly error messages
    if (errorMessage.includes('AUTHENTICATIONFAILED') || errorMessage.includes('Invalid credentials')) {
      errorMessage = 'Invalid email or password. For Gmail, make sure you\'re using an App Password.';
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      errorMessage = 'Could not connect to mail server. Check the host address.';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused. Check the server address and port.';
    } else if (errorMessage.includes('certificate')) {
      errorMessage = 'SSL certificate error. The server may have an invalid certificate.';
    }

    return { success: false, error: errorMessage };
  }
}

// Folders to skip during import (contain duplicates or are system folders)
const SKIP_FOLDERS = [
  '[Gmail]/All Mail',
  '[Gmail]/Important',
  '[Gmail]/Starred',
  '[Gmail]/Trash',
  '[Gmail]/Spam',
  '[Gmail]/Drafts',
  '[Gmail]/Sent Mail',
  'Sent',
  'Sent Items',
  'Sent Messages',
];

// Import all emails from all folders
export async function importAllEmails(
  onProgress: (status: ImportStatus) => void
): Promise<EmailMessage[]> {
  const imapConfigured = getSetting('imap_configured') === 'true';

  if (!imapConfigured || config.app.useMockImap) {
    throw new Error('IMAP not configured. Please configure your email account first.');
  }

  const provider = getSetting('imap_provider') || 'custom';
  const providerConfig = IMAP_PROVIDERS[provider] || IMAP_PROVIDERS.custom;
  const host = getSetting('imap_host') || providerConfig.host;
  const port = parseInt(getSetting('imap_port') || String(providerConfig.port), 10);
  const user = getSetting('imap_user') || '';
  const password = getSetting('imap_password') || '';

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass: password },
    logger: false,
  });

  const allEmails: EmailMessage[] = [];
  const seenMessageIds = new Set<string>();

  try {
    onProgress({
      active: true,
      phase: 'Connecting...',
      currentFolder: '',
      foldersProcessed: 0,
      totalFolders: 0,
      emailsFound: 0,
      emailsImported: 0,
      duplicatesSkipped: 0,
    });

    await client.connect();

    onProgress({
      active: true,
      phase: 'Listing folders...',
      currentFolder: '',
      foldersProcessed: 0,
      totalFolders: 0,
      emailsFound: 0,
      emailsImported: 0,
      duplicatesSkipped: 0,
    });

    // List all mailboxes
    const mailboxes = await client.list();

    // Filter to only selectable mailboxes and skip duplicating folders
    const foldersToScan = mailboxes
      .filter(mb => !mb.flags.has('\\Noselect'))
      .filter(mb => !SKIP_FOLDERS.includes(mb.path))
      .map(mb => mb.path);

    const totalFolders = foldersToScan.length;
    let foldersProcessed = 0;
    let emailsFound = 0;
    let emailsImported = 0;
    let duplicatesSkipped = 0;

    for (const folderPath of foldersToScan) {
      onProgress({
        active: true,
        phase: 'Importing emails...',
        currentFolder: folderPath,
        foldersProcessed,
        totalFolders,
        emailsFound,
        emailsImported,
        duplicatesSkipped,
      });

      try {
        const mailbox = await client.mailboxOpen(folderPath);

        if (!mailbox.exists || mailbox.exists === 0) {
          foldersProcessed++;
          continue;
        }

        // Fetch all messages in this folder
        const messages = client.fetch('1:*', {
          envelope: true,
          source: true,
          uid: true,
        }, { changedSince: 0n });

        for await (const message of messages) {
          emailsFound++;

          try {
            if (!message.source) continue;

            const parsed = await simpleParser(message.source);
            const messageId = message.envelope?.messageId || `uid-${folderPath}-${message.uid}`;

            // Skip duplicates
            if (seenMessageIds.has(messageId)) {
              duplicatesSkipped++;
              continue;
            }
            seenMessageIds.add(messageId);

            const fromAddr = parsed.from?.value?.[0]?.address ||
                            message.envelope?.from?.[0]?.address ||
                            'unknown';

            const headers: Record<string, string> = {};
            const unsubscribe = parsed.headers.get('list-unsubscribe');
            if (unsubscribe) {
              headers['List-Unsubscribe'] = String(unsubscribe);
            }

            let bodyPreview = '';
            if (parsed.text) {
              bodyPreview = parsed.text.substring(0, 500);
            } else if (parsed.html) {
              bodyPreview = parsed.html.replace(/<[^>]*>/g, '').substring(0, 500);
            }

            allEmails.push({
              messageId,
              fromAddr,
              subject: parsed.subject || message.envelope?.subject || '(no subject)',
              body: bodyPreview,
              date: parsed.date || message.envelope?.date || new Date(),
              headers,
            });

            emailsImported++;

            // Update progress every 10 emails
            if (emailsImported % 10 === 0) {
              onProgress({
                active: true,
                phase: 'Importing emails...',
                currentFolder: folderPath,
                foldersProcessed,
                totalFolders,
                emailsFound,
                emailsImported,
                duplicatesSkipped,
              });
            }
          } catch (parseError) {
            console.error('Error parsing email:', parseError);
          }
        }
      } catch (folderError) {
        console.error(`Error processing folder ${folderPath}:`, folderError);
      }

      foldersProcessed++;
    }

    onProgress({
      active: false,
      phase: 'Complete',
      currentFolder: '',
      foldersProcessed,
      totalFolders,
      emailsFound,
      emailsImported,
      duplicatesSkipped,
    });

    return allEmails;

  } finally {
    await client.logout();
  }
}
