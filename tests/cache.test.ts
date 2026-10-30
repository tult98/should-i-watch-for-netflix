import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  MATCH_TTL_MS,
  NO_MATCH_TTL_MS,
  clearLookupCache,
  createLookupCache,
  lookupCacheKey,
  type KeyValueStore,
} from '../src/background/cache';
import type { LookupResult } from '../src/shared/types';

const match: LookupResult = {
  status: 'match',
  info: {
    id: 'mal:16498',
    kind: 'anime',
    title: 'Shingeki no Kyojin',
    genres: [],
    scores: [],
    match: { query: 'Attack on Titan', matchedName: 'Attack on Titan', confidence: 1, source: 'mal' },
    format: 'TV',
    status: 'Finished Airing',
    aired: {},
    studios: [],
  },
};

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
    keys: async () => [...data.keys()],
  };
}

function setup() {
  let time = 1_000;
  const store = memoryStore();
  const cache = createLookupCache(store, () => time);
  return { store, cache, advance: (ms: number) => (time += ms) };
}

describe('lookupCacheKey', () => {
  it('uses language, normalized title, and year or a dash', () => {
    expect(lookupCacheKey('en', 'Attack on Titan!', 2013)).toBe('lookup:en|attack on titan|2013');
    expect(lookupCacheKey('vi', 'Đảo Hải Tặc')).toBe('lookup:vi|dao hai tac|-');
  });
});

describe('lookup cache', () => {
  it('keeps a match for 7 days', async () => {
    const { cache, advance } = setup();
    await cache.set('k', match);
    advance(MATCH_TTL_MS - 1);
    expect(await cache.get('k')).toEqual(match);
    advance(1);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('keeps a no_match for 1 day', async () => {
    const { cache, advance } = setup();
    await cache.set('k', { status: 'no_match' });
    expect(NO_MATCH_TTL_MS).toBe(DAY_MS);
    advance(DAY_MS - 1);
    expect(await cache.get('k')).toEqual({ status: 'no_match' });
    advance(1);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('removes an expired entry from storage', async () => {
    const { cache, store, advance } = setup();
    await cache.set('k', { status: 'no_match' });
    advance(DAY_MS);
    await cache.get('k');
    expect(store.data.has('k')).toBe(false);
  });

  it('never caches errors', async () => {
    const { cache, store } = setup();
    await cache.set('k', { status: 'error', reason: 'rate_limited' });
    await cache.set('n', { status: 'error', reason: 'network' });
    expect(store.data.size).toBe(0);
    expect(await cache.get('k')).toBeUndefined();
  });

  it('ignores malformed stored values', async () => {
    const { cache, store } = setup();
    store.data.set('k', 'junk');
    expect(await cache.get('k')).toBeUndefined();
  });
});

describe('clearLookupCache', () => {
  it('removes only lookup keys and reports the count', async () => {
    const { store, cache } = setup();
    await cache.set(lookupCacheKey('en', 'Lupin'), match);
    await cache.set(lookupCacheKey('en', 'Naruto', 2002), match);
    store.data.set('settings', { tmdbKey: 'k' });
    store.data.set('taste:ratings', []);
    expect(await clearLookupCache(store)).toBe(2);
    expect([...store.data.keys()].sort()).toEqual(['settings', 'taste:ratings']);
  });

  it('returns 0 when nothing is cached', async () => {
    expect(await clearLookupCache(setup().store)).toBe(0);
  });
});
