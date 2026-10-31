import { describe, expect, it, vi } from 'vitest';
import { aiCacheKey } from '../src/background/ai/aiCache';
import { AIError, type AIProvider } from '../src/background/ai/AIProvider';
import { createAiService } from '../src/background/ai/aiService';
import type { KeyValueStore } from '../src/background/cache';
import { getTasteProfile, type TasteProfile } from '../src/background/taste/tasteProfile';
import { createTasteStore } from '../src/background/taste/tasteStore';
import type { QuickBadge } from '../src/shared/quickBadge';
import type { AiProfile, Settings } from '../src/shared/settings';
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

const deepseek = (patch: Partial<AiProfile> = {}): Settings => ({
  aiProfiles: { deepseek: { format: 'openai', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', key: 'sk', ...patch } },
});

function setup(settings: Settings = deepseek(), version = 0) {
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
  const ds = { provider: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' } as const;

  it('includes the title, kind, taste version, provider, host, model and locale', () => {
    expect(aiCacheKey('mal:1', 'anime', 3, ds, 'vi')).toBe('ai:mal:1|anime|v3|deepseek@api.deepseek.com|deepseek-chat|vi');
    expect(aiCacheKey('mal:1', 'anime', 3, ds, 'en')).not.toBe(aiCacheKey('mal:1', 'anime', 3, ds, 'vi'));
  });

  it('separates providers, hosts and models', () => {
    const base = aiCacheKey('mal:1', 'anime', 3, ds, 'vi');
    const openrouter = { provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1/chat/completions', model: 'deepseek-chat' } as const;
    expect(aiCacheKey('mal:1', 'anime', 3, openrouter, 'vi')).not.toBe(base);
    expect(aiCacheKey('mal:1', 'anime', 3, { ...ds, provider: 'custom' }, 'vi')).not.toBe(base);
    expect(aiCacheKey('mal:1', 'anime', 3, { ...ds, baseUrl: 'https://other.example/chat' }, 'vi')).not.toBe(base);
    expect(aiCacheKey('mal:1', 'anime', 3, { ...ds, model: 'deepseek-reasoner' }, 'vi')).not.toBe(base);
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
    expect(store.data.has('ai:mal:1|anime|v0|deepseek@api.deepseek.com|deepseek-chat|vi')).toBe(true);
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
    state.settings = deepseek({ model: 'deepseek-reasoner' });
    await service.opinion(info, badge);
    expect(opinionFn).toHaveBeenCalledTimes(3);
  });

  it('labels a preset with its name and a custom provider with its hostname', async () => {
    const preset = setup({ aiProvider: 'openai', aiProfiles: { openai: { format: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'm', key: 'sk' } } });
    expect(await preset.service.opinion(info, badge)).toMatchObject({ providerLabel: 'OpenAI', model: 'm' });
    const custom = setup({ aiProvider: 'custom', aiProfiles: { custom: { format: 'openai', baseUrl: 'https://llm.example.com/v1/chat/completions', model: 'm', key: 'sk' } } });
    expect(await custom.service.opinion(info, badge)).toMatchObject({ providerLabel: 'llm.example.com', model: 'm' });
  });

  it('does not serve one provider the cached opinion of another', async () => {
    const { service, opinionFn, state } = setup();
    await service.opinion(info, badge);
    state.settings = { aiProvider: 'openai', aiProfiles: { openai: { format: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'deepseek-chat', key: 'sk' } } };
    expect(await service.cached(info)).toEqual({ status: 'none' });
    await service.opinion(info, badge);
    expect(opinionFn).toHaveBeenCalledTimes(2);
  });

  it('calls a keyless provider such as Ollama without a key', async () => {
    const { service, opinionFn } = setup({ aiProvider: 'ollama' });
    expect(await service.opinion(info, badge)).toMatchObject({ status: 'ok', providerLabel: 'Ollama', model: 'llama3.2' });
    expect(opinionFn).toHaveBeenCalledOnce();
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
      loadSettings: async () => deepseek(),
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
      'ai:mal:1|anime|v0|deepseek@api.deepseek.com|deepseek-chat|vi',
      'ai:mal:1|anime|v1|deepseek@api.deepseek.com|deepseek-chat|vi',
    ]);
  });
});
