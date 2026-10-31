import { RequestError, type FetchFn } from '../requestQueue';
import { AIError } from './AIProvider';
import type { ProviderConfig } from './aiCore';

export interface HttpReply {
  ok: boolean;
  status: number;
  text: string;
}

// A missing key only fails the call when the provider needs one (Ollama does not).
export function keyOf(config: ProviderConfig): string | undefined {
  const key = config.key?.trim() || undefined;
  if (!key && config.keyRequired !== false) throw new AIError('missing_ai_key');
  return key;
}

export async function postJson(fetch: FetchFn, url: string, headers: Record<string, string>, body: unknown): Promise<HttpReply> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof RequestError && err.reason === 'rate_limited') throw new AIError('rate_limited');
    throw new AIError('network', err instanceof Error ? err.message : String(err));
  }
  const text = await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, text };
}

export function httpError(status: number, body: string): AIError {
  return new AIError('network', `HTTP ${status}: ${body.slice(0, 200)}`);
}

export function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
