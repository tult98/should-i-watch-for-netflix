import { normalizeTitle } from '../shared/normalize';
import type { LookupResult } from '../shared/types';

const LOOKUP_PREFIX = 'lookup:';

export const DAY_MS = 24 * 60 * 60 * 1_000;
export const MATCH_TTL_MS = 7 * DAY_MS;
export const NO_MATCH_TTL_MS = DAY_MS;

export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

interface Entry {
  value: LookupResult;
  expiresAt: number;
}

export interface LookupCache {
  get(key: string): Promise<LookupResult | undefined>;
  set(key: string, result: LookupResult): Promise<void>;
}

export function lookupCacheKey(lang: string, title: string, year?: number): string {
  return `${LOOKUP_PREFIX}${lang}|${normalizeTitle(title)}|${year ?? '-'}`;
}

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Entry).expiresAt === 'number' &&
    typeof (value as Entry).value === 'object'
  );
}

export function createLookupCache(store: KeyValueStore, now: () => number = Date.now): LookupCache {
  return {
    async get(key) {
      const entry = await store.get(key);
      if (!isEntry(entry)) return undefined;
      if (entry.expiresAt <= now()) {
        await store.remove(key);
        return undefined;
      }
      return entry.value;
    },
    async set(key, result) {
      if (result.status === 'error') return;
      const ttl = result.status === 'match' ? MATCH_TTL_MS : NO_MATCH_TTL_MS;
      const entry: Entry = { value: result, expiresAt: now() + ttl };
      await store.set(key, entry);
    },
  };
}

export async function clearLookupCache(store: KeyValueStore): Promise<number> {
  const stale = (await store.keys()).filter((key) => key.startsWith(LOOKUP_PREFIX));
  for (const key of stale) await store.remove(key);
  return stale.length;
}

export function chromeLocalStore(): KeyValueStore {
  return {
    async get(key) {
      const items = await chrome.storage.local.get(key);
      return items[key];
    },
    set: (key, value) => chrome.storage.local.set({ [key]: value }),
    remove: (key) => chrome.storage.local.remove(key),
    keys: async () => Object.keys(await chrome.storage.local.get(null)),
  };
}
