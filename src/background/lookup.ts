import type { LookupRequest } from '../shared/messages';
import type { LookupResult } from '../shared/types';
import type { MalAdapter } from './adapters/MalAdapter';
import { lookupCacheKey, type LookupCache } from './cache';
import { RequestError } from './requestQueue';

export interface LookupDeps {
  cache: LookupCache;
  mal: MalAdapter;
  log?: (message: string) => void;
}

export type Lookup = (request: LookupRequest) => Promise<LookupResult>;

function toError(err: unknown): LookupResult {
  if (err instanceof RequestError) return { status: 'error', reason: err.reason };
  return { status: 'error', reason: 'network' };
}

export function createLookup(deps: LookupDeps): Lookup {
  const log = deps.log ?? (() => {});
  const inFlight = new Map<string, Promise<LookupResult>>();

  async function resolve(request: LookupRequest): Promise<LookupResult> {
    log(`[sw] fetch jikan ${request.title}`);
    try {
      const anime = await deps.mal.search(request.title, request.year);
      return anime ? { status: 'match', info: anime } : { status: 'no_match' };
    } catch (err) {
      return toError(err);
    }
  }

  async function lookup(request: LookupRequest, key: string): Promise<LookupResult> {
    const cached = await deps.cache.get(key);
    if (cached) {
      log(`[sw] cache hit ${key}`);
      return cached;
    }
    const result = await resolve(request);
    await deps.cache.set(key, result);
    return result;
  }

  return (request) => {
    const key = lookupCacheKey(request.lang, request.title, request.year);
    const pending = inFlight.get(key);
    if (pending) return pending;
    const promise = lookup(request, key).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}
