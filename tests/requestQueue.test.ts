import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestError, createRequestQueue, parseRetryAfter, type FetchFn } from '../src/background/requestQueue';

const JIKAN = 'https://api.jikan.moe/v4/anime?q=x';

function ok(): Response {
  return new Response('{}', { status: 200 });
}

function tooMany(retryAfter?: string): Response {
  return new Response('', { status: 429, headers: retryAfter ? { 'Retry-After': retryAfter } : {} });
}

function setup(respond: () => Response | Promise<Response> = ok) {
  const calls: number[] = [];
  const fetch = vi.fn<FetchFn>(async () => {
    calls.push(Date.now());
    return respond();
  });
  const queue = createRequestQueue({
    fetch,
    clock: { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) },
  });
  return { queue, fetch, calls };
}

describe('requestQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('sends at most 3 Jikan requests per second', async () => {
    const { queue, calls } = setup();
    const all = Promise.all(Array.from({ length: 7 }, () => queue.fetch(JIKAN)));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([0, 0, 0]);
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toEqual([0, 0, 0, 1000, 1000, 1000]);
    await vi.advanceTimersByTimeAsync(1000);
    await all;
    expect(calls).toEqual([0, 0, 0, 1000, 1000, 1000, 2000]);
  });

  it('sends at most 60 Jikan requests per minute', async () => {
    const { queue, calls } = setup();
    const all = Promise.all(Array.from({ length: 61 }, () => queue.fetch(JIKAN)));
    await vi.advanceTimersByTimeAsync(30_000);
    expect(calls).toHaveLength(60);
    expect(calls[59]).toBe(19_000);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(calls).toHaveLength(60);
    await vi.advanceTimersByTimeAsync(1);
    await all;
    expect(calls[60]).toBe(60_000);
  });

  it('does not limit hosts without a configured window', async () => {
    const { queue, calls } = setup();
    await Promise.all(Array.from({ length: 10 }, () => queue.fetch('https://example.com/')));
    expect(calls).toHaveLength(10);
  });

  it('keeps a separate window per host', async () => {
    const { queue, calls } = setup();
    void Promise.all(Array.from({ length: 3 }, () => queue.fetch(JIKAN)));
    void queue.fetch('https://api.themoviedb.org/3/search/multi');
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual([0, 0, 0, 0]);
  });

  it('waits Retry-After seconds on a 429', async () => {
    const responses = [tooMany('5'), ok()];
    const { queue, calls } = setup(() => responses.shift()!);
    const result = queue.fetch(JIKAN);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(calls).toEqual([0]);
    await vi.advanceTimersByTimeAsync(1);
    expect((await result).status).toBe(200);
    expect(calls).toEqual([0, 5_000]);
  });

  it('backs off 1 s, 2 s, then 4 s without Retry-After', async () => {
    const responses = [tooMany(), tooMany(), tooMany(), ok()];
    const { queue, calls } = setup(() => responses.shift()!);
    const result = queue.fetch(JIKAN);
    await vi.advanceTimersByTimeAsync(7_000);
    expect((await result).status).toBe(200);
    expect(calls).toEqual([0, 1_000, 3_000, 7_000]);
  });

  it('gives up with rate_limited after three retries', async () => {
    const { queue, calls } = setup(() => tooMany());
    const result = queue.fetch(JIKAN).catch((e: unknown) => e);
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
    await expect(queue.fetch(JIKAN)).rejects.toMatchObject({ reason: 'network' });
  });

  it('returns other error statuses to the caller', async () => {
    const { queue } = setup(() => new Response('', { status: 500 }));
    expect((await queue.fetch(JIKAN)).status).toBe(500);
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
