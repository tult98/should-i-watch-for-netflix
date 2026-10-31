import { describe, expect, it, vi } from 'vitest';
import { AIError, type OpinionInput } from '../src/background/ai/AIProvider';
import { createProvider, providerLabel } from '../src/background/ai/createProvider';
import type { ProviderConfig } from '../src/background/ai/aiCore';
import { RequestError, type FetchFn } from '../src/background/requestQueue';
import type { MovieInfo } from '../src/shared/types';

const good = { summary_vi: 'Tóm tắt.', verdict: 'maybe', reason_vi: 'Lý do.' };

const movie: MovieInfo = {
  id: 'tmdb:movie:1',
  kind: 'movie',
  title: 'X',
  genres: [],
  scores: [],
  match: { query: 'X', matchedName: 'X', confidence: 1, source: 'tmdb' },
  directors: [],
  cast: [],
};

const input: OpinionInput = {
  info: movie,
  taste: { kind: 'movie', version: 0, count: { up: 0, down: 0 }, likedGenres: [], dislikedGenres: [] },
  badge: { verdict: null, source: null, score: null, lowVotes: false },
  needSummary: true,
};

const ANTHROPIC: ProviderConfig = {
  provider: 'anthropic',
  format: 'anthropic',
  baseUrl: 'https://api.anthropic.com/v1/messages',
  model: 'claude-haiku-4-5',
  key: 'sk-ant',
};
const GEMINI: ProviderConfig = {
  provider: 'gemini',
  format: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-2.5-flash',
  key: 'g-key',
};
const OLLAMA: ProviderConfig = {
  provider: 'ollama',
  format: 'openai',
  baseUrl: 'http://localhost:11434/v1/chat/completions',
  model: 'llama3.2',
};

const anthropicReply = (text: string) => new Response(JSON.stringify({ content: [{ type: 'text', text }] }));
const geminiReply = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
const openaiReply = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }));

async function reason(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(AIError);
    return (err as AIError).reason;
  }
}

function body(fetch: ReturnType<typeof vi.fn<FetchFn>>, call = 0) {
  return JSON.parse(fetch.mock.calls[call]![1]?.body as string);
}

describe('anthropic transport', () => {
  it('posts to the messages URL with the key headers and a lifted system prompt', async () => {
    const fetch = vi.fn<FetchFn>(async () => anthropicReply(JSON.stringify(good)));
    expect(await createProvider(fetch, ANTHROPIC).opinion(input)).toEqual(good);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(ANTHROPIC.baseUrl);
    expect(init?.headers).toMatchObject({
      'x-api-key': 'sk-ant',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    });
    const sent = body(fetch);
    expect(sent).toMatchObject({ model: 'claude-haiku-4-5', max_tokens: 1024, temperature: 0.3 });
    expect(sent.system).toContain('viewing advisor');
    expect(sent.messages.map((m: { role: string }) => m.role)).toEqual(['user']);
  });

  it('keeps the correction retry turns after the system prompt', async () => {
    const fetch = vi.fn<FetchFn>();
    fetch.mockResolvedValueOnce(anthropicReply('nope')).mockResolvedValueOnce(anthropicReply(JSON.stringify(good)));
    await createProvider(fetch, ANTHROPIC).opinion(input);
    expect(body(fetch, 1).messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('maps statuses to reasons', async () => {
    const status = (code: number, text = '{}') => vi.fn<FetchFn>(async () => new Response(text, { status: code }));
    const run = (f: ReturnType<typeof status>) => reason(createProvider(f, ANTHROPIC).opinion(input));
    expect(await run(status(401))).toBe('bad_ai_key');
    expect(await run(status(403))).toBe('bad_ai_key');
    expect(await run(status(429))).toBe('rate_limited');
    expect(await run(status(400, '{"error":{"message":"Your credit balance is too low"}}'))).toBe('ai_no_balance');
    expect(await run(status(400, '{"error":{"message":"bad"}}'))).toBe('network');
    expect(await run(status(500))).toBe('network');
  });

  it('needs a key', async () => {
    const fetch = vi.fn<FetchFn>();
    expect(await reason(createProvider(fetch, { ...ANTHROPIC, key: ' ' }).opinion(input))).toBe('missing_ai_key');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('gemini transport', () => {
  it('posts to models/{model}:generateContent with the key header and mapped roles', async () => {
    const fetch = vi.fn<FetchFn>();
    fetch.mockResolvedValueOnce(geminiReply('nope')).mockResolvedValueOnce(geminiReply(JSON.stringify(good)));
    expect(await createProvider(fetch, GEMINI).opinion(input)).toEqual(good);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'g-key', 'Content-Type': 'application/json' });
    const first = body(fetch);
    expect(first.generationConfig).toEqual({ temperature: 0.3, responseMimeType: 'application/json' });
    expect(first.systemInstruction.parts[0].text).toContain('viewing advisor');
    expect(first.contents.map((c: { role: string }) => c.role)).toEqual(['user']);
    expect(body(fetch, 1).contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('encodes the model name and tolerates a trailing slash on the base', async () => {
    const fetch = vi.fn<FetchFn>(async () => geminiReply('{}'));
    await createProvider(fetch, { ...GEMINI, baseUrl: `${GEMINI.baseUrl}/`, model: 'tuned/my model' }).ping();
    expect(fetch.mock.calls[0]![0]).toBe(`${GEMINI.baseUrl}/models/tuned%2Fmy%20model:generateContent`);
  });

  it('maps statuses to reasons', async () => {
    const status = (code: number, text = '{}') => vi.fn<FetchFn>(async () => new Response(text, { status: code }));
    const run = (f: ReturnType<typeof status>) => reason(createProvider(f, GEMINI).opinion(input));
    expect(await run(status(401))).toBe('bad_ai_key');
    expect(await run(status(403))).toBe('bad_ai_key');
    expect(await run(status(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}'))).toBe('bad_ai_key');
    expect(await run(status(400, '{"error":{"message":"bad"}}'))).toBe('network');
    expect(await run(status(429))).toBe('rate_limited');
    expect(await run(status(500))).toBe('network');
  });

  it('treats a reply without candidates as invalid', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('{"candidates":[]}'));
    expect(await reason(createProvider(fetch, GEMINI).opinion(input))).toBe('ai_bad_response');
  });
});

describe('openai transport key handling', () => {
  it('omits Authorization and does not throw for a keyless provider such as Ollama', async () => {
    const fetch = vi.fn<FetchFn>(async () => openaiReply(JSON.stringify(good)));
    expect(await createProvider(fetch, OLLAMA).opinion(input)).toEqual(good);
    expect(fetch.mock.calls[0]![0]).toBe(OLLAMA.baseUrl);
    expect(fetch.mock.calls[0]![1]?.headers).not.toHaveProperty('Authorization');
  });

  it('still sends a key when an Ollama proxy is given one', async () => {
    const fetch = vi.fn<FetchFn>(async () => openaiReply('{}'));
    await createProvider(fetch, { ...OLLAMA, key: 'k' }).ping();
    expect(fetch.mock.calls[0]![1]?.headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('requires a key for every other provider and for an explicit keyRequired', async () => {
    const fetch = vi.fn<FetchFn>();
    const openai: ProviderConfig = { provider: 'openai', format: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'm' };
    expect(await reason(createProvider(fetch, openai).ping())).toBe('missing_ai_key');
    expect(await reason(createProvider(fetch, { ...OLLAMA, keyRequired: true }).ping())).toBe('missing_ai_key');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('ping', () => {
  it('accepts a JSON object and rejects other replies as ai_bad_response', async () => {
    const ok = vi.fn<FetchFn>(async () => anthropicReply('{"ok": true}'));
    await expect(createProvider(ok, ANTHROPIC).ping()).resolves.toBeUndefined();
    expect(body(ok).max_tokens).toBe(16);
    for (const text of ['hello', '[1, 2]', '{broken']) {
      const bad = vi.fn<FetchFn>(async () => openaiReply(text));
      expect(await reason(createProvider(bad, OLLAMA).ping())).toBe('ai_bad_response');
    }
  });

  it('sends no token cap to Gemini', async () => {
    const fetch = vi.fn<FetchFn>(async () => geminiReply('{}'));
    await createProvider(fetch, GEMINI).ping();
    expect(JSON.stringify(body(fetch))).not.toContain('maxOutputTokens');
  });
});

describe('transport failures', () => {
  it('maps a queue rate limit and other fetch errors', async () => {
    const limited = vi.fn<FetchFn>(async () => {
      throw new RequestError('rate_limited');
    });
    expect(await reason(createProvider(limited, GEMINI).ping())).toBe('rate_limited');
    const down = vi.fn<FetchFn>(async () => {
      throw new Error('offline');
    });
    expect(await reason(createProvider(down, ANTHROPIC).ping())).toBe('network');
  });
});

describe('createProvider', () => {
  it('uses the host as id', () => {
    expect(createProvider(vi.fn(), GEMINI).id).toBe('generativelanguage.googleapis.com');
    expect(createProvider(vi.fn(), OLLAMA).id).toBe('localhost:11434');
  });
});

describe('providerLabel', () => {
  it('names the preset and falls back to the host for Custom', () => {
    expect(providerLabel({ provider: 'anthropic', baseUrl: ANTHROPIC.baseUrl })).toBe('Anthropic');
    expect(providerLabel({ provider: 'custom', baseUrl: 'https://llm.example.com/v1/chat/completions' })).toBe('llm.example.com');
    expect(providerLabel({ baseUrl: 'https://openrouter.ai/api/v1/chat/completions' })).toBe('openrouter.ai');
  });
});
