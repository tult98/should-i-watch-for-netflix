import { describe, expect, it, vi } from 'vitest';
import { aiCacheKey } from '../src/background/ai/aiCache';
import { AIError, type AIProvider } from '../src/background/ai/AIProvider';
import { createAiService } from '../src/background/ai/aiService';
import type { KeyValueStore } from '../src/background/cache';
import { getTasteProfile, type TasteProfile } from '../src/background/taste/tasteProfile';
import { createTasteStore } from '../src/background/taste/tasteStore';
import type { QuickBadge } from '../src/shared/quickBadge';
import type { Settings } from '../src/shared/settings';
import type { AIOpinion, AnimeInfo, MovieInfo } from '../src/shared/types';

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

const info: AnimeInfo = {
  id: 'mal:1',
  kind: 'anime',
  title: 'X',
  genres: [],
  scores: [],
  match: { query: 'X', matchedName: 'X', confidence: 1, source: 'mal' },
  format: 'TV',
  status: 'Finished Airing',
  aired: {},
  studios: [],
};
const badge: QuickBadge = { verdict: null, source: null, score: null, lowVotes: false };
const opinion: AIOpinion = { summary_vi: 'Tóm tắt.', verdict: 'maybe', reason_vi: 'Lý do.' };

function setup(settings: Settings = { aiKey: 'sk' }, version = 0) {
  const store = memoryStore();
  const state = { settings, version };
  const opinionFn = vi.fn<AIProvider['opinion']>(async () => opinion);
  const logs: string[] = [];
  const service = createAiService({
    store,
    loadSettings: async () => state.settings,
    getTasteProfile: async (kind): Promise<TasteProfile> => ({
      kind,
      version: state.version,
      count: { up: state.version, down: 0 },
      likedGenres: [],
      dislikedGenres: [],
    }),
    provider: () => ({ id: 'test', opinion: opinionFn }),
    log: (m) => logs.push(m),
  });
  return { store, state, opinionFn, logs, service };
}

describe('aiCacheKey', () => {
  it('includes the title, kind, taste version, model and locale', () => {
    expect(aiCacheKey('mal:1', 'anime', 3, 'deepseek-chat', 'vi')).toBe('ai:mal:1|anime|v3|deepseek-chat|vi');
    expect(aiCacheKey('mal:1', 'anime', 3, 'deepseek-chat', 'en')).not.toBe(aiCacheKey('mal:1', 'anime', 3, 'deepseek-chat', 'vi'));
  });
});

describe('aiService', () => {
  it('fetches once, stores the opinion, then answers from the cache', async () => {
    const { service, opinionFn, store, logs } = setup();
    const first = await service.opinion(info, badge);
    expect(first).toEqual({
      status: 'ok',
      opinion,
      providerLabel: 'DeepSeek',
      model: 'deepseek-chat',
      tasteCount: 0,
      fromCache: false,
    });
    expect(store.data.has('ai:mal:1|anime|v0|deepseek-chat|vi')).toBe(true);
    const second = await service.opinion(info, badge);
    expect(second).toMatchObject({ status: 'ok', fromCache: true });
    expect(opinionFn).toHaveBeenCalledTimes(1);
    expect(opinionFn.mock.calls[0]![0].needSummary).toBe(true);
    expect(logs).toEqual(['[sw] ai fetch mal:1', '[sw] ai cache hit mal:1']);
  });

  it('asks again when the taste version or the model changes', async () => {
    const { service, opinionFn, state } = setup();
    await service.opinion(info, badge);
    state.version = 1;
    await service.opinion(info, badge);
    state.settings = { aiKey: 'sk', aiModel: 'deepseek-reasoner' };
    await service.opinion(info, badge);
    expect(opinionFn).toHaveBeenCalledTimes(3);
  });

  it('labels a custom provider with its hostname', async () => {
    const { service } = setup({ aiKey: 'sk', aiBaseUrl: 'https://openrouter.ai/api/v1/chat/completions', aiModel: 'm' });
    expect(await service.opinion(info, badge)).toMatchObject({ providerLabel: 'openrouter.ai', model: 'm' });
  });

  it('reads the cache without ever calling the API', async () => {
    const { service, opinionFn } = setup();
    expect(await service.cached(info)).toEqual({ status: 'none' });
    await service.opinion(info, badge);
    expect(await service.cached(info)).toMatchObject({ status: 'ok', opinion, fromCache: true });
    expect(opinionFn).toHaveBeenCalledTimes(1);
  });

  it('returns missing_ai_key without calling the provider', async () => {
    const { service, opinionFn, logs } = setup({});
    expect(await service.opinion(info, badge)).toEqual({ status: 'error', reason: 'missing_ai_key' });
    expect(opinionFn).not.toHaveBeenCalled();
    expect(logs).toEqual(['[sw] ai error missing_ai_key']);
  });

  it('does not cache errors', async () => {
    const { service, opinionFn, store } = setup();
    opinionFn.mockRejectedValueOnce(new AIError('ai_no_balance'));
    expect(await service.opinion(info, badge)).toEqual({ status: 'error', reason: 'ai_no_balance' });
    expect(store.data.size).toBe(0);
    expect(await service.opinion(info, badge)).toMatchObject({ status: 'ok', fromCache: false });
  });

  it('shares one request between concurrent clicks', async () => {
    const { service, opinionFn } = setup();
    await Promise.all([service.opinion(info, badge), service.opinion(info, badge)]);
    expect(opinionFn).toHaveBeenCalledTimes(1);
  });
});

describe('aiService with the real taste store', () => {
  const movie: MovieInfo = {
    id: 'tmdb:movie:2',
    kind: 'movie',
    title: 'Y',
    genres: ['Crime'],
    scores: [],
    match: { query: 'Y', matchedName: 'Y', confidence: 1, source: 'tmdb' },
    directors: [],
    cast: [],
  };

  it('asks again after a rating of the same kind, not of another kind', async () => {
    const store = memoryStore();
    const taste = createTasteStore(store);
    const opinionFn = vi.fn<AIProvider['opinion']>(async () => opinion);
    const service = createAiService({
      store,
      loadSettings: async () => ({ aiKey: 'sk' }),
      getTasteProfile: (kind) => getTasteProfile(kind, taste),
      provider: () => ({ id: 'test', opinion: opinionFn }),
    });
    await service.opinion(info, badge);
    await taste.rate(movie, 'up');
    expect(await service.opinion(info, badge)).toMatchObject({ fromCache: true, tasteCount: 0 });
    await taste.rate({ ...info, id: 'mal:9' }, 'up');
    expect(await service.opinion(info, badge)).toMatchObject({ fromCache: false, tasteCount: 1 });
    expect(opinionFn).toHaveBeenCalledTimes(2);
    expect([...store.data.keys()].filter((k) => k.startsWith('ai:'))).toEqual([
      'ai:mal:1|anime|v0|deepseek-chat|vi',
      'ai:mal:1|anime|v1|deepseek-chat|vi',
    ]);
  });
});
