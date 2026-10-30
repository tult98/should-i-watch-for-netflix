import { describe, expect, it, vi } from 'vitest';
import type { MalAdapter } from '../src/background/adapters/MalAdapter';
import type { LookupCache } from '../src/background/cache';
import { createLookup } from '../src/background/lookup';
import { RequestError } from '../src/background/requestQueue';
import type { AnimeInfo, LookupResult } from '../src/shared/types';

const anime = { id: 'mal:21', kind: 'anime' } as AnimeInfo;

function setup(search: MalAdapter['search']) {
  const data = new Map<string, LookupResult>();
  const cache: LookupCache = {
    get: async (key) => data.get(key),
    set: async (key, result) => {
      if (result.status !== 'error') data.set(key, result);
    },
  };
  const mal = { search: vi.fn(search) };
  const logs: string[] = [];
  const lookup = createLookup({ cache, mal, log: (m) => logs.push(m) });
  return { lookup, mal, logs, data };
}

const request = { type: 'lookup' as const, title: 'One Piece', lang: 'en' };

describe('lookup', () => {
  it('fetches on a miss and reads the cache on the second call', async () => {
    const { lookup, mal, logs } = setup(async () => anime);
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(mal.search).toHaveBeenCalledTimes(1);
    expect(mal.search).toHaveBeenCalledWith('One Piece', undefined);
    expect(logs).toEqual(['[sw] fetch jikan One Piece', '[sw] cache hit lookup:en|one piece|-']);
  });

  it('caches no_match', async () => {
    const { lookup, mal } = setup(async () => null);
    expect(await lookup(request)).toEqual({ status: 'no_match' });
    await lookup(request);
    expect(mal.search).toHaveBeenCalledTimes(1);
  });

  it('maps a rate limit to an uncached error', async () => {
    const { lookup, mal, data } = setup(async () => {
      throw new RequestError('rate_limited');
    });
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'rate_limited' });
    expect(data.size).toBe(0);
    await lookup(request);
    expect(mal.search).toHaveBeenCalledTimes(2);
  });

  it('maps an unexpected failure to a network error', async () => {
    const { lookup } = setup(async () => {
      throw new SyntaxError('Unexpected token');
    });
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'network' });
  });

  it('shares one search between concurrent identical lookups', async () => {
    const { lookup, mal } = setup(async () => anime);
    await Promise.all([lookup(request), lookup({ ...request, title: 'ONE PIECE!' })]);
    expect(mal.search).toHaveBeenCalledTimes(1);
  });
});
