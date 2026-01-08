import { config } from '../config.js';
import type { Classification, OllamaClassification } from '../types.js';

// Model-specific optimized configuration for best accuracy and performance
// Each model family has different strengths, prompt preferences, and resource requirements

interface ModelConfig {
  // Prompts optimized for this model's instruction format
  prompts: {
    single: string;
    batch: string;
  };
  // Optimal number of parallel workers (based on model speed/size)
  workers: number;
  // Batch size (emails per Ollama request)
  batchSize: number;
  // Initial concurrency for parallel batch requests
  concurrency: number;
  // Brief description for UI
  description: string;
  // Speed tier: fast, medium, slow
  speed: 'fast' | 'medium' | 'slow';
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // Qwen 2.5 - Very instruction-following, likes structured format
  // 0.5b is extremely fast, larger variants are slower
  'qwen2.5': {
    prompts: {
      single: `Task: Email Classification
Categories: spam, newsletter, keep

Definitions:
- spam: unwanted ads, scams, phishing, junk
- newsletter: subscriptions, marketing, company updates
- keep: personal messages, work emails, receipts, important notifications

Email:
From: {fromAddr}
Subject: {subject}
Content: {bodyPreview}

Output JSON: {"classification":"<category>","confidence":<0.0-1.0>}`,
      batch: `Task: Classify each email as spam, newsletter, or keep.

spam=unwanted/scams/junk | newsletter=subscriptions/marketing | keep=personal/work/important

{emails}

Output JSON array with one object per email: [{"classification":"<category>","confidence":<0.0-1.0>}]`
    },
    workers: 16,
    batchSize: 8,
    concurrency: 12,
    description: 'Fastest model, great accuracy. Ideal for bulk processing.',
    speed: 'fast'
  },

  // Llama 3.2 - Good at following instructions, prefers clear examples
  'llama3.2': {
    prompts: {
      single: `You are an email classifier. Classify the email into exactly one category.

CATEGORIES:
spam - Junk mail, scams, phishing attempts, unsolicited ads
newsletter - Subscription emails, marketing, company newsletters
keep - Personal emails, work messages, receipts, important notifications

EMAIL TO CLASSIFY:
From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

Respond with ONLY this JSON format:
{"classification": "spam" or "newsletter" or "keep", "confidence": 0.0 to 1.0}`,
      batch: `Classify each email below into: spam, newsletter, or keep.

spam = junk/scams/phishing
newsletter = subscriptions/marketing/updates
keep = personal/work/important

{emails}

Return a JSON array with one classification per email in order:
[{"classification": "spam|newsletter|keep", "confidence": 0.0-1.0}]`
    },
    workers: 8,
    batchSize: 6,
    concurrency: 8,
    description: 'Excellent accuracy, moderate speed. Good balance.',
    speed: 'medium'
  },

  // Phi-3 - Microsoft model, likes concise prompts with examples
  'phi3': {
    prompts: {
      single: `Email Classification Task

Input Email:
- From: {fromAddr}
- Subject: {subject}
- Body: {bodyPreview}

Classify as one of:
• spam (junk, scam, phishing, unwanted promotional)
• newsletter (subscriptions, marketing emails, company updates)
• keep (personal, work, receipts, important)

JSON Response: {"classification":"VALUE","confidence":SCORE}`,
      batch: `Classify emails into: spam | newsletter | keep

{emails}

JSON array response: [{"classification":"VALUE","confidence":SCORE}]`
    },
    workers: 10,
    batchSize: 6,
    concurrency: 10,
    description: 'Fast Microsoft model with good reasoning.',
    speed: 'fast'
  },

  // Gemma 2 - Google model, good with structured tasks
  'gemma2': {
    prompts: {
      single: `<task>Classify email</task>
<categories>
spam: unwanted, scam, phishing, junk ads
newsletter: subscriptions, marketing, updates
keep: personal, work, receipts, important
</categories>
<email>
From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}
</email>
<output format="json">{"classification":"spam|newsletter|keep","confidence":0.0-1.0}</output>`,
      batch: `<task>Classify each email</task>
<categories>spam|newsletter|keep</categories>
{emails}
<output format="json">[{"classification":"VALUE","confidence":SCORE}]</output>`
    },
    workers: 8,
    batchSize: 5,
    concurrency: 8,
    description: 'Google model, excellent at structured tasks.',
    speed: 'medium'
  },

  // Gemma 3 - Newer Google model, more capable
  'gemma3': {
    prompts: {
      single: `Classify this email into one category: spam, newsletter, or keep.

- spam: junk mail, scams, phishing, unwanted promotional content
- newsletter: subscription emails, marketing, company updates you signed up for
- keep: personal correspondence, work emails, receipts, important notifications

From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

Reply in JSON format only: {"classification": "category", "confidence": 0.0-1.0}`,
      batch: `Classify each email as spam, newsletter, or keep:

{emails}

Reply with JSON array: [{"classification": "category", "confidence": 0.0-1.0}]`
    },
    workers: 6,
    batchSize: 5,
    concurrency: 6,
    description: 'Latest Google model, best accuracy but slower.',
    speed: 'slow'
  },

  // Mistral - Good instruction following, efficient
  'mistral': {
    prompts: {
      single: `[INST] Classify this email into exactly one category: spam, newsletter, or keep.

Categories:
- spam: Unsolicited promotional emails, phishing, scams, junk mail
- newsletter: Legitimate subscription emails, marketing from known companies
- keep: Personal emails, work correspondence, receipts, important notifications

Email details:
From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

Respond with only JSON: {"classification": "spam|newsletter|keep", "confidence": 0.0-1.0} [/INST]`,
      batch: `[INST] Classify each email as spam, newsletter, or keep.

{emails}

Respond with JSON array only: [{"classification": "category", "confidence": score}] [/INST]`
    },
    workers: 8,
    batchSize: 6,
    concurrency: 8,
    description: 'Efficient European model, good for nuanced text.',
    speed: 'medium'
  },

  // TinyLlama - Very small, extremely fast, needs simple prompts
  'tinyllama': {
    prompts: {
      single: `Email type? spam, newsletter, or keep

From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

spam=junk newsletter=subscriptions keep=important

JSON: {"classification":"TYPE","confidence":0.9}`,
      batch: `Type each email: spam, newsletter, keep

{emails}

JSON: [{"classification":"TYPE","confidence":0.9}]`
    },
    workers: 20,
    batchSize: 10,
    concurrency: 16,
    description: 'Ultra-fast tiny model. Lower accuracy, maximum speed.',
    speed: 'fast'
  },

  // Orca Mini - Good at following instructions
  'orca-mini': {
    prompts: {
      single: `### Instruction:
Classify this email as spam, newsletter, or keep.

### Input:
From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

### Categories:
- spam: junk, scam, phishing
- newsletter: subscriptions, marketing
- keep: personal, work, important

### Response (JSON only):
{"classification": "category", "confidence": 0.0-1.0}`,
      batch: `### Instruction:
Classify each email as spam, newsletter, or keep.

### Input:
{emails}

### Response (JSON array):
[{"classification": "category", "confidence": score}]`
    },
    workers: 12,
    batchSize: 8,
    concurrency: 10,
    description: 'Small model trained on instructions. Fast and reliable.',
    speed: 'fast'
  },

  // Llama 3.1 - Larger, more capable model
  'llama3.1': {
    prompts: {
      single: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an email classifier. Output only valid JSON.<|eot_id|><|start_header_id|>user<|end_header_id|>
Classify this email as: spam, newsletter, or keep.

From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

Categories:
- spam: junk, scams, phishing, unwanted ads
- newsletter: subscriptions, marketing, company updates
- keep: personal, work, receipts, important<|eot_id|><|start_header_id|>assistant<|end_header_id|>
{"classification":"`,
      batch: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You classify emails. Output JSON array only.<|eot_id|><|start_header_id|>user<|end_header_id|>
Classify each email as spam, newsletter, or keep:

{emails}<|eot_id|><|start_header_id|>assistant<|end_header_id|>
[`
    },
    workers: 4,
    batchSize: 4,
    concurrency: 4,
    description: 'Large model, highest accuracy but resource-intensive.',
    speed: 'slow'
  },

  // Deepseek coder/chat models
  'deepseek': {
    prompts: {
      single: `You must classify emails. Output JSON only.

Email to classify:
From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

Categories:
- spam: junk, scams, phishing
- newsletter: subscriptions, marketing emails
- keep: personal, work, important

Output: {"classification": "spam|newsletter|keep", "confidence": 0.0-1.0}`,
      batch: `Classify these emails as spam, newsletter, or keep:

{emails}

Output JSON array: [{"classification": "category", "confidence": score}]`
    },
    workers: 6,
    batchSize: 5,
    concurrency: 6,
    description: 'Deepseek model, strong reasoning capabilities.',
    speed: 'medium'
  },

  // Default fallback - works with most models
  'default': {
    prompts: {
      single: `Classify this email as spam, newsletter, or keep.

spam = junk, scam, phishing, unwanted ads
newsletter = subscriptions, marketing, updates from companies
keep = personal, work, receipts, important

From: {fromAddr}
Subject: {subject}
Body: {bodyPreview}

Reply JSON only: {"classification":"spam|newsletter|keep","confidence":0.9}`,
      batch: `Classify each email as spam, newsletter, or keep.

spam=junk/scam newsletter=subscriptions/marketing keep=personal/work/important

{emails}

Reply JSON array: [{"classification":"spam|newsletter|keep","confidence":0.9}]`
    },
    workers: 8,
    batchSize: 6,
    concurrency: 8,
    description: 'Generic settings for unknown models.',
    speed: 'medium'
  }
};

// Type for prompts only (backwards compatibility)
interface ModelPrompts {
  single: string;
  batch: string;
}

// Get the full config for a given model
export function getConfigForModel(model: string): ModelConfig {
  const modelLower = model.toLowerCase();

  // Check for model family matches (order matters - more specific first)
  const orderedKeys = Object.keys(MODEL_CONFIGS)
    .filter(k => k !== 'default')
    .sort((a, b) => b.length - a.length); // Longer keys first for better matching

  for (const key of orderedKeys) {
    if (modelLower.includes(key)) {
      return MODEL_CONFIGS[key];
    }
  }

  return MODEL_CONFIGS['default'];
}

// Get the best prompt for a given model (backwards compatible)
export function getPromptsForModel(model: string): ModelPrompts {
  return getConfigForModel(model).prompts;
}

// Get list of supported model families
export function getSupportedModels(): string[] {
  return Object.keys(MODEL_CONFIGS).filter(k => k !== 'default');
}

// Get all model configs (for API/UI)
export function getAllModelConfigs(): Record<string, Omit<ModelConfig, 'prompts'> & { promptPreview: string }> {
  const result: Record<string, Omit<ModelConfig, 'prompts'> & { promptPreview: string }> = {};

  for (const [key, cfg] of Object.entries(MODEL_CONFIGS)) {
    if (key === 'default') continue;
    result[key] = {
      workers: cfg.workers,
      batchSize: cfg.batchSize,
      concurrency: cfg.concurrency,
      description: cfg.description,
      speed: cfg.speed,
      promptPreview: cfg.prompts.single.slice(0, 100) + '...',
    };
  }

  return result;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.host;
    this.model = config.ollama.model;
  }

  async classifyEmail(fromAddr: string, subject: string, bodyPreview: string): Promise<OllamaClassification> {
    // Get model-specific prompt for best accuracy
    const prompts = getPromptsForModel(this.model);
    const prompt = prompts.single
      .replace('{fromAddr}', fromAddr)
      .replace('{subject}', subject)
      .replace('{bodyPreview}', bodyPreview.slice(0, 500));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
          keep_alive: '30m', // Keep model loaded for 30 minutes
          options: {
            num_predict: 100, // Limit response length for speed
            temperature: 0.1, // Low temperature for consistent classification
          },
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
        legitimate: 'keep', // backwards compatibility
      };

      const classification = classificationMap[parsed.classification?.toLowerCase() ?? ''] ?? 'unknown';

      return {
        classification,
        confidence: parsed.confidence ?? 0.5,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Ollama request timed out');
      } else {
        console.error(`Ollama error: ${error}`);
      }

      return {
        classification: 'unknown',
        confidence: 0,
        reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Batch classify multiple emails in a single request for speed
  async classifyEmailBatch(
    emails: Array<{ fromAddr: string; subject: string; bodyPreview: string }>
  ): Promise<OllamaClassification[]> {
    if (emails.length === 0) return [];

    // Get model-specific prompt for best accuracy
    const prompts = getPromptsForModel(this.model);

    // Build email list for prompt (truncate body for speed)
    const emailList = emails
      .map(
        (e, i) =>
          `[${i + 1}] From: ${e.fromAddr}\nSubject: ${e.subject}\nBody: ${e.bodyPreview.slice(0, 200)}`
      )
      .join('\n\n');

    const prompt = prompts.batch.replace('{emails}', emailList);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min for batch

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
          keep_alive: '30m',
          options: {
            num_predict: 500, // More tokens for batch response
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama batch request failed: ${response.status}`);
      }

      const result = (await response.json()) as { response?: string };
      const text = result.response ?? '[]';

      // Parse the JSON array response
      let parsed: Array<{ classification?: string; confidence?: number }>;
      try {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          parsed = [parsed]; // Handle single object response
        }
      } catch {
        console.error('Failed to parse batch response:', text);
        // Fall back to individual classification
        return emails.map(() => ({ classification: 'unknown' as Classification, confidence: 0 }));
      }

      const classificationMap: Record<string, Classification> = {
        spam: 'spam',
        newsletter: 'newsletter',
        keep: 'keep',
        legitimate: 'keep',
      };

      // Map results back, handling missing entries
      return emails.map((_, i) => {
        const item = parsed[i] || {};
        return {
          classification: classificationMap[item.classification?.toLowerCase() ?? ''] ?? 'unknown',
          confidence: item.confidence ?? 0.5,
        };
      });
    } catch (error) {
      console.error(`Ollama batch error: ${error}`);
      // Return unknown for all on error
      return emails.map(() => ({ classification: 'unknown' as Classification, confidence: 0 }));
    }
  }

  async analyzeUnsubscribeResponse(
    url: string,
    statusCode: number,
    responseBody: string,
    error?: string
  ): Promise<{ success: boolean; explanation: string; nextAction?: string }> {
    const prompt = `You are analyzing the result of an unsubscribe request to a newsletter.

URL: ${url}
HTTP Status: ${statusCode}
${error ? `Error: ${error}` : ''}
Response Body (first 2000 chars):
${responseBody.slice(0, 2000)}

Analyze this response and determine:
1. Was the unsubscribe successful?
2. If not, what went wrong?
3. Is there a next action needed (like clicking a confirmation link)?

Respond in JSON format only:
{"success": true/false, "explanation": "what happened", "nextAction": "optional - what user should do next if not successful"}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, explanation: `Ollama request failed: ${response.status}` };
      }

      const result = (await response.json()) as { response?: string };
      const text = result.response ?? '{}';
      const parsed = JSON.parse(text) as { success?: boolean; explanation?: string; nextAction?: string };

      return {
        success: parsed.success ?? false,
        explanation: parsed.explanation ?? 'Unable to determine result',
        nextAction: parsed.nextAction,
      };
    } catch (err) {
      return {
        success: false,
        explanation: `Analysis error: ${err instanceof Error ? err.message : 'Unknown'}`,
      };
    }
  }
}
