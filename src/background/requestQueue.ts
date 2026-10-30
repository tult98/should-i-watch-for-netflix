export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface RateWindow {
  limit: number;
  ms: number;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export class RequestError extends Error {
  constructor(readonly reason: 'network' | 'rate_limited', message?: string) {
    super(message ?? reason);
    this.name = 'RequestError';
  }
}

export const DEFAULT_LIMITS: Record<string, RateWindow[]> = {
  'api.jikan.moe': [
    { limit: 3, ms: 1_000 },
    { limit: 60, ms: 60_000 },
  ],
  'api.themoviedb.org': [{ limit: 20, ms: 1_000 }],
  'www.omdbapi.com': [{ limit: 5, ms: 1_000 }],
};

export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface RequestQueueOptions {
  fetch: FetchFn;
  clock?: Clock;
  limits?: Record<string, RateWindow[]>;
}

export interface RequestQueue {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

export function parseRetryAfter(header: string | null, now: number): number | undefined {
  if (header === null || header.trim() === '') return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

export function createRequestQueue(options: RequestQueueOptions): RequestQueue {
  const clock = options.clock ?? systemClock;
  const limits = options.limits ?? DEFAULT_LIMITS;
  const sent = new Map<string, number[]>();
  const tails = new Map<string, Promise<void>>();

  async function waitForSlot(host: string, windows: RateWindow[]): Promise<void> {
    const stamps = sent.get(host) ?? [];
    sent.set(host, stamps);
    const longest = Math.max(...windows.map((w) => w.ms));
    for (;;) {
      const now = clock.now();
      while (stamps.length > 0 && stamps[0]! <= now - longest) stamps.shift();
      let wait = 0;
      for (const w of windows) {
        const inWindow = stamps.filter((t) => t > now - w.ms);
        if (inWindow.length >= w.limit) {
          wait = Math.max(wait, inWindow[inWindow.length - w.limit]! + w.ms - now);
        }
      }
      if (wait <= 0) {
        stamps.push(now);
        return;
      }
      await clock.sleep(wait);
    }
  }

  // Slots are handed out in arrival order per host; the fetches themselves overlap.
  function acquire(host: string): Promise<void> {
    const windows = limits[host];
    if (!windows || windows.length === 0) return Promise.resolve();
    const prev = tails.get(host) ?? Promise.resolve();
    const next = prev.then(() => waitForSlot(host, windows));
    tails.set(host, next);
    return next;
  }

  async function send(url: string, init?: RequestInit): Promise<Response> {
    const host = new URL(url).host;
    for (let attempt = 0; ; attempt++) {
      await acquire(host);
      let response: Response;
      try {
        response = await options.fetch(url, init);
      } catch (err) {
        throw new RequestError('network', err instanceof Error ? err.message : String(err));
      }
      if (response.status !== 429) return response;
      if (attempt >= RETRY_DELAYS_MS.length) throw new RequestError('rate_limited');
      const delay =
        parseRetryAfter(response.headers.get('Retry-After'), clock.now()) ?? RETRY_DELAYS_MS[attempt]!;
      await clock.sleep(delay);
    }
  }

  return { fetch: send };
}
