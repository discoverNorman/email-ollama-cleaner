import { OllamaClient } from './ollama-client.js';

export interface UnsubscribeResult {
  success: boolean;
  method: string;
  statusCode?: number;
  explanation: string;
  nextAction?: string;
  rawResponse?: string;
}

export class UnsubscribeExecutor {
  private ollama: OllamaClient;

  constructor() {
    this.ollama = new OllamaClient();
  }

  async execute(url: string, method: 'one-click' | 'link' | 'mailto'): Promise<UnsubscribeResult> {
    if (method === 'mailto') {
      return {
        success: false,
        method,
        explanation: 'Mailto unsubscribe requires sending an email - not yet automated',
        nextAction: `Send email to: ${url.replace('mailto:', '')}`,
      };
    }

    try {
      let response: Response;
      let responseBody: string;

      if (method === 'one-click') {
        // RFC 8058 One-Click Unsubscribe - POST with specific header
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'List-Unsubscribe': 'One-Click',
          },
          body: 'List-Unsubscribe=One-Click-Unsubscribe',
          redirect: 'follow',
        });
      } else {
        // Regular link - just GET the URL
        response = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; EmailCleaner/1.0)',
          },
        });
      }

      responseBody = await response.text();

      // Quick success checks
      if (response.ok) {
        const lowerBody = responseBody.toLowerCase();
        const successIndicators = [
          'unsubscribed',
          'successfully removed',
          'been removed',
          'no longer receive',
          'subscription cancelled',
          'subscription canceled',
          'opt-out successful',
          'removed from',
          'preferences updated',
        ];

        const hasSuccessIndicator = successIndicators.some((ind) => lowerBody.includes(ind));

        if (hasSuccessIndicator) {
          return {
            success: true,
            method,
            statusCode: response.status,
            explanation: 'Unsubscribe appears successful based on response content',
            rawResponse: responseBody.slice(0, 500),
          };
        }

        // Response is OK but unclear - ask Ollama
        const analysis = await this.ollama.analyzeUnsubscribeResponse(url, response.status, responseBody);

        return {
          success: analysis.success,
          method,
          statusCode: response.status,
          explanation: analysis.explanation,
          nextAction: analysis.nextAction,
          rawResponse: responseBody.slice(0, 500),
        };
      }

      // Non-OK response - ask Ollama to analyze
      const analysis = await this.ollama.analyzeUnsubscribeResponse(
        url,
        response.status,
        responseBody,
        `HTTP ${response.status} ${response.statusText}`
      );

      return {
        success: analysis.success,
        method,
        statusCode: response.status,
        explanation: analysis.explanation,
        nextAction: analysis.nextAction,
        rawResponse: responseBody.slice(0, 500),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      // Network error - ask Ollama for suggestions
      const analysis = await this.ollama.analyzeUnsubscribeResponse(url, 0, '', errorMsg);

      return {
        success: false,
        method,
        explanation: analysis.explanation || `Request failed: ${errorMsg}`,
        nextAction: analysis.nextAction || 'Try manually visiting the unsubscribe link',
      };
    }
  }

  async executeBatch(
    tasks: Array<{ id: number; url: string; method: 'one-click' | 'link' | 'mailto' }>
  ): Promise<Map<number, UnsubscribeResult>> {
    const results = new Map<number, UnsubscribeResult>();

    for (const task of tasks) {
      // Add delay between requests to be polite
      if (results.size > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }

      const result = await this.execute(task.url, task.method);
      results.set(task.id, result);
    }

    return results;
  }
}
