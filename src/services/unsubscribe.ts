import type { UnsubscribeInfo } from '../types.js';

export function extractUnsubscribeInfo(headers: Record<string, string>, body: string): UnsubscribeInfo {
  const listUnsubscribe = headers['List-Unsubscribe'] ?? '';

  if (listUnsubscribe) {
    const urlMatch = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/);
    if (urlMatch) {
      return { url: urlMatch[1], method: 'one-click' };
    }

    const mailtoMatch = listUnsubscribe.match(/<(mailto:[^>]+)>/);
    if (mailtoMatch) {
      return { url: mailtoMatch[1], method: 'mailto' };
    }
  }

  const unsubscribePatterns = [
    /(https?:\/\/[^\s<>"']+unsubscribe[^\s<>"']*)/i,
    /(https?:\/\/[^\s<>"']+optout[^\s<>"']*)/i,
    /(https?:\/\/[^\s<>"']+opt-out[^\s<>"']*)/i,
    /(https?:\/\/[^\s<>"']+remove[^\s<>"']*)/i,
    /(https?:\/\/[^\s<>"']+preferences[^\s<>"']*)/i,
  ];

  for (const pattern of unsubscribePatterns) {
    const match = body.match(pattern);
    if (match) {
      return { url: match[1], method: 'link' };
    }
  }

  return { url: null, method: 'none' };
}
