import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIError, type OpinionInput } from '../src/background/ai/AIProvider';
import {
  AI_TIMEOUT_MS,
  createOpenAICompatibleProvider,
  providerLabel,
} from '../src/background/ai/OpenAICompatibleProvider';
import { createRequestQueue, systemClock, type FetchFn } from '../src/background/requestQueue';
import type { MovieInfo } from '../src/shared/types';

const URL_ = 'https://api.deepseek.com/chat/completions';
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

function reply(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), { status });
}

function provider(fetch: FetchFn, key: string | undefined = 'sk-test') {
  return createOpenAICompatibleProvider(fetch, { baseUrl: URL_, model: 'deepseek-chat', key });
}

async function reason(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(AIError);
    return (err as AIError).reason;
  }
}

describe('OpenAICompatibleProvider', () => {
  afterEach(() => vi.useRealTimers());

  it('posts the chat completion request and returns the validated opinion', async () => {
    const fetch = vi.fn<FetchFn>(async () => reply(JSON.stringify(good)));
    expect(await provider(fetch).opinion(input)).toEqual(good);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(URL_);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({ model: 'deepseek-chat', response_format: { type: 'json_object' }, temperature: 0.3 });
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
  });

  it('retries once with the bad reply and a correction, then succeeds', async () => {
    const fetch = vi.fn<FetchFn>();
    fetch.mockResolvedValueOnce(reply('not json')).mockResolvedValueOnce(reply(JSON.stringify(good)));
    expect(await provider(fetch).opinion(input)).toEqual(good);
    const body = JSON.parse(fetch.mock.calls[1]![1]?.body as string);
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(body.messages[2].content).toBe('not json');
    expect(body.messages[3].content).toContain('json');
  });

  it('fails with ai_bad_response after a second invalid reply', async () => {
    const fetch = vi.fn<FetchFn>(async () => reply(JSON.stringify({ ...good, verdict: 'watch' })));
    expect(await reason(provider(fetch).opinion(input))).toBe('ai_bad_response');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('treats a body without choices as an invalid reply', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('{}'));
    expect(await reason(provider(fetch).opinion(input))).toBe('ai_bad_response');
  });

  it('maps 401, 402, 429 and other statuses', async () => {
    const status = (code: number) => vi.fn<FetchFn>(async () => new Response('{"error":{}}', { status: code }));
    expect(await reason(provider(status(401)).opinion(input))).toBe('bad_ai_key');
    expect(await reason(provider(status(402)).opinion(input))).toBe('ai_no_balance');
    expect(await reason(provider(status(429)).opinion(input))).toBe('rate_limited');
    expect(await reason(provider(status(500)).opinion(input))).toBe('network');
  });

  it('fails with missing_ai_key without calling the API', async () => {
    const fetch = vi.fn<FetchFn>();
    expect(await reason(provider(fetch, '  ').opinion(input))).toBe('missing_ai_key');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('times out after 30 s through the queue as a network error', async () => {
    vi.useFakeTimers();
    const queue = createRequestQueue({
      fetch: () => new Promise<Response>(() => {}),
      clock: { ...systemClock, setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as number) },
      timeoutFor: (host) => (host === 'api.deepseek.com' ? AI_TIMEOUT_MS : undefined),
    });
    let result: string | undefined | 'pending' = 'pending';
    void reason(provider(queue.fetch).opinion(input)).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS - 1);
    expect(result).toBe('pending');
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toBe('network');
  });

  it('pings with a tiny request', async () => {
    const fetch = vi.fn<FetchFn>(async () => reply('{"ok":true}'));
    await provider(fetch).ping();
    expect(JSON.parse(fetch.mock.calls[0]![1]?.body as string).max_tokens).toBe(16);
  });
});

describe('providerLabel', () => {
  it('names DeepSeek and falls back to the hostname', () => {
    expect(providerLabel(URL_)).toBe('DeepSeek');
    expect(providerLabel('https://openrouter.ai/api/v1/chat/completions')).toBe('openrouter.ai');
  });
});
