import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REQUEST_TIMEOUT_MS,
  RequestError,
  createRequestQueue,
  parseRetryAfter,
  type FetchFn,
} from '../src/background/requestQueue';

const MAL = 'https://api.myanimelist.net/v2/anime?q=x';
const CINEMETA = 'https://v3-cinemeta.strem.io/catalog/movie/top/search=x.json';
const ANILIST = 'https://graphql.anilist.co';

function ok(): Response {
  return new Response('{}', { status: 200 });
}

function tooMany(retryAfter?: string): Response {
  return new Response('', { status: 429, headers: retryAfter ? { 'Retry-After': retryAfter } : {} });
}

function setup(
  respond: (init?: RequestInit) => Response | Promise<Response> = ok,
  timeoutFor?: (host: string) => number | undefined,
) {
  const calls: number[] = [];
  const fetch = vi.fn<FetchFn>(async (_url, init) => {
    calls.push(Date.now());
    return respond(init);
  });
  const queue = createRequestQueue({
    fetch,
    clock: {
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    timeoutFor,
  });
  return { queue, fetch, calls };
}

describe('requestQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('sends at most 5 Cinemeta requests per second', async () => {
    const { queue, calls } = setup();
    const all = Promise.all(Array.from({ length: 11 }, () => queue.fetch(CINEMETA)));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([0, 0, 0, 0, 0]);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(5);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(10);
    await vi.advanceTimersByTimeAsync(1000);
    await all;
    expect(calls[10]).toBe(2000);
  });

  it('sends at most 30 AniList requests per minute', async () => {
    const { queue, calls } = setup();
    const all = Promise.all(Array.from({ length: 31 }, () => queue.fetch(ANILIST, { method: 'POST' })));
    await vi.advanceTimersByTimeAsync(59_999);
    expect(calls).toHaveLength(30);
    expect(calls.every((t) => t === 0)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await all;
    expect(calls[30]).toBe(60_000);
  });

  it('sends at most 3 MAL API requests per second', async () => {
    const { queue, calls } = setup();
    const all = Promise.all(
      Array.from({ length: 4 }, () => queue.fetch('https://api.myanimelist.net/v2/anime?q=abc')),
    );
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toEqual([0, 0, 0]);
    await vi.advanceTimersByTimeAsync(1);
    await all;
    expect(calls).toEqual([0, 0, 0, 1000]);
  });

  it('does not limit hosts without a configured window', async () => {
    const { queue, calls } = setup();
    await Promise.all(Array.from({ length: 10 }, () => queue.fetch('https://example.com/')));
    expect(calls).toHaveLength(10);
  });

  it('keeps a separate window per host', async () => {
    const { queue, calls } = setup();
    void Promise.all(Array.from({ length: 3 }, () => queue.fetch(MAL)));
    void queue.fetch('https://api.themoviedb.org/3/search/multi');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([0, 0, 0, 0]);
  });

  it('waits Retry-After seconds on a 429', async () => {
    const responses = [tooMany('5'), ok()];
    const { queue, calls } = setup(() => responses.shift()!);
    const result = queue.fetch(MAL);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1);
    expect((await result).status).toBe(200);
    expect(calls).toEqual([0, 5_000]);
  });

  it('backs off 1 s, 2 s, then 4 s without Retry-After', async () => {
    const responses = [tooMany(), tooMany(), tooMany(), ok()];
    const { queue, calls } = setup(() => responses.shift()!);
    const result = queue.fetch(MAL);
    await vi.advanceTimersByTimeAsync(7_000);
    expect((await result).status).toBe(200);
    expect(calls).toEqual([0, 1_000, 3_000, 7_000]);
  });

  it('gives up with rate_limited after three retries', async () => {
    const { queue, calls } = setup(() => tooMany());
    const result = queue.fetch(MAL).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await result;
    expect(error).toBeInstanceOf(RequestError);
    expect((error as RequestError).reason).toBe('rate_limited');
    expect(calls).toHaveLength(4);
  });

  it('reports a thrown fetch as a network error', async () => {
    const { queue } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    await expect(queue.fetch(MAL)).rejects.toMatchObject({ reason: 'network' });
  });

  it('aborts a request that hangs past the timeout as a network error', async () => {
    let signal: AbortSignal | undefined;
    const { queue } = setup((init) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const result = queue.fetch(MAL).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await result;
    expect(error).toBeInstanceOf(RequestError);
    expect((error as RequestError).reason).toBe('network');
    expect(signal?.aborted).toBe(true);
  });

  it('uses a per-host timeout and keeps the default for other hosts', async () => {
    const hang = () => new Promise<Response>(() => {});
    const { queue } = setup(hang, (host) => (host === 'api.deepseek.com' ? 30_000 : undefined));
    let aiDone = false;
    let malDone = false;
    void queue.fetch('https://api.deepseek.com/chat/completions').catch(() => (aiDone = true));
    void queue.fetch(MAL).catch(() => (malDone = true));
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(malDone).toBe(true);
    expect(aiDone).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000 - REQUEST_TIMEOUT_MS);
    expect(aiDone).toBe(true);
  });

  it('clears the timeout once the response arrives', async () => {
    const { queue } = setup();
    await queue.fetch(MAL);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns other error statuses to the caller', async () => {
    const { queue } = setup(() => new Response('', { status: 500 }));
    expect((await queue.fetch(MAL)).status).toBe(500);
  });
});

describe('parseRetryAfter', () => {
  it('reads seconds and HTTP dates', () => {
    expect(parseRetryAfter('2', 0)).toBe(2_000);
    expect(parseRetryAfter('Thu, 01 Jan 1970 00:00:03 GMT', 1_000)).toBe(2_000);
    expect(parseRetryAfter(null, 0)).toBeUndefined();
    expect(parseRetryAfter('soon', 0)).toBeUndefined();
  });
});
