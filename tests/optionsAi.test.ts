import { describe, expect, it, vi } from 'vitest';
import { testAiConnection } from '../src/options/ai';
import type { FetchFn } from '../src/background/requestQueue';

const granted = { request: async () => true };

describe('testAiConnection', () => {
  it('reports ok when the provider answers', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('{"choices":[{"message":{"content":"{}"}}]}'));
    expect(await testAiConnection({ aiKey: 'sk' }, granted, fetch)).toEqual({ ok: true });
    expect(fetch.mock.calls[0]![0]).toBe('https://api.deepseek.com/chat/completions');
  });

  it('reports the provider error reason', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('', { status: 401 }));
    expect(await testAiConnection({ aiKey: 'bad' }, granted, fetch)).toEqual({ ok: false, reason: 'bad_ai_key' });
    expect(await testAiConnection({}, granted, fetch)).toEqual({ ok: false, reason: 'missing_ai_key' });
  });

  it('stops when the custom origin permission is denied', async () => {
    const fetch = vi.fn<FetchFn>();
    const out = await testAiConnection(
      { aiBaseUrl: 'https://openrouter.ai/api/v1/chat/completions', aiKey: 'sk' },
      { request: async () => false },
      fetch,
    );
    expect(out).toEqual({ ok: false, reason: 'denied' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
