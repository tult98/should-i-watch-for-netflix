import { describe, expect, it, vi } from 'vitest';
import { ensureAiPermission, permissionHostFor, testAiConnection, type AiDraft } from '../src/options/ai';
import type { FetchFn } from '../src/background/requestQueue';

const granted = { request: async () => true };

const draft = (patch: Partial<AiDraft> = {}): AiDraft => ({
  provider: 'deepseek',
  format: 'openai',
  baseUrl: 'https://api.deepseek.com/chat/completions',
  model: 'deepseek-chat',
  key: 'sk',
  ...patch,
});

describe('testAiConnection', () => {
  it('reports ok when the provider answers', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('{"choices":[{"message":{"content":"{}"}}]}'));
    expect(await testAiConnection(draft(), granted, fetch)).toEqual({ ok: true, ms: expect.any(Number) });
    expect(fetch.mock.calls[0]![0]).toBe('https://api.deepseek.com/chat/completions');
  });

  it('reports the provider error reason', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('', { status: 401 }));
    expect(await testAiConnection(draft({ key: 'bad' }), granted, fetch)).toEqual({ ok: false, reason: 'bad_ai_key' });
    expect(await testAiConnection(draft({ key: undefined }), granted, fetch)).toEqual({ ok: false, reason: 'missing_ai_key' });
  });

  it('stops when the custom origin permission is denied', async () => {
    const fetch = vi.fn<FetchFn>();
    const out = await testAiConnection(
      draft({ provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1/chat/completions' }),
      { request: async () => false },
      fetch,
    );
    expect(out).toEqual({ ok: false, reason: 'denied' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tests a keyless local provider and a non-JSON reply', async () => {
    const ollama = draft({ provider: 'ollama', baseUrl: 'http://localhost:11434/v1/chat/completions', model: 'llama3.2', key: undefined });
    const ok = vi.fn<FetchFn>(async () => new Response('{"choices":[{"message":{"content":"{}"}}]}'));
    expect(await testAiConnection(ollama, granted, ok)).toMatchObject({ ok: true });
    const bad = vi.fn<FetchFn>(async () => new Response('{"choices":[{"message":{"content":"hello"}}]}'));
    expect(await testAiConnection(ollama, granted, bad)).toEqual({ ok: false, reason: 'ai_bad_response' });
  });

  it('reports the elapsed time of the ping', async () => {
    const times = [100, 740];
    vi.spyOn(performance, 'now').mockImplementation(() => times.shift() ?? 740);
    const fetch = vi.fn<FetchFn>(async () => new Response('{"choices":[{"message":{"content":"{}"}}]}'));
    expect(await testAiConnection(draft(), granted, fetch)).toEqual({ ok: true, ms: 640 });
    vi.restoreAllMocks();
  });
});

describe('ensureAiPermission', () => {
  it('requests the origin of a custom https URL', async () => {
    const request = vi.fn(async () => true);
    expect(await ensureAiPermission('https://llm.example.com:8443/v1/chat/completions', { request })).toBe('granted');
    expect(request).toHaveBeenCalledWith({ origins: ['https://llm.example.com/*'] });
  });

  it('does not ask for DeepSeek, which the manifest already grants', async () => {
    const request = vi.fn(async () => true);
    expect(await ensureAiPermission('https://api.deepseek.com/chat/completions', { request })).toBe('granted');
    expect(request).not.toHaveBeenCalled();
  });

  it('requests http://localhost/* without the port', async () => {
    const request = vi.fn(async () => true);
    await ensureAiPermission('http://localhost:11434/v1/chat/completions', { request });
    expect(request).toHaveBeenCalledWith({ origins: ['http://localhost/*'] });
    await ensureAiPermission('http://127.0.0.1:8080/x', { request });
    expect(request).toHaveBeenLastCalledWith({ origins: ['http://127.0.0.1/*'] });
  });

  it('refuses an invalid or empty URL without asking, and reports a denial or a throw as denied', async () => {
    const request = vi.fn(async () => true);
    expect(await ensureAiPermission('http://example.com', { request })).toBe('invalid_url');
    expect(await ensureAiPermission('', { request })).toBe('invalid_url');
    expect(await ensureAiPermission(undefined, { request })).toBe('invalid_url');
    expect(request).not.toHaveBeenCalled();
    expect(await ensureAiPermission('https://a.example', { request: async () => false })).toBe('denied');
    expect(await ensureAiPermission('https://a.example', { request: () => Promise.reject(new Error('x')) })).toBe('denied');
  });
});

describe('permissionHostFor', () => {
  it('names the host only when a prompt will appear', () => {
    expect(permissionHostFor('https://api.deepseek.com/chat/completions')).toBeNull();
    expect(permissionHostFor('https://api.openai.com/v1/chat/completions')).toBe('api.openai.com');
    expect(permissionHostFor('http://localhost:11434/v1')).toBe('localhost');
    expect(permissionHostFor('nonsense')).toBeNull();
    expect(permissionHostFor('')).toBeNull();
  });
});
