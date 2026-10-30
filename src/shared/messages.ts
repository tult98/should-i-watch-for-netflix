import type { LookupResult } from './types';

export interface LookupRequest {
  type: 'lookup';
  title: string;
  year?: number;
  lang: string;
  netflixId?: string;
}

export type LookupResponse = LookupResult;

export function isLookupRequest(message: unknown): message is LookupRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return m.type === 'lookup' && typeof m.title === 'string' && typeof m.lang === 'string';
}

export function sendLookup(request: Omit<LookupRequest, 'type'>): Promise<LookupResponse> {
  const message: LookupRequest = { type: 'lookup', ...request };
  try {
    return Promise.resolve(chrome.runtime.sendMessage<LookupRequest, LookupResponse>(message));
  } catch (err) {
    // sendMessage throws synchronously once the extension context is invalidated.
    return Promise.reject(err);
  }
}
