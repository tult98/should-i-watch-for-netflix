import { describe, expect, it, vi } from 'vitest';
import type { KeyValueStore } from '../src/background/cache';
import { saveAndInvalidate, saveThresholdSet, saveWithPermission } from '../src/options/save';
import { DEFAULT_AI_BASE_URL, DEFAULT_THRESHOLDS, SETTINGS_KEY, sourceKeysChanged } from '../src/shared/settings';

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

describe('sourceKeysChanged', () => {
  it('is false for identical settings', () => {
    expect(sourceKeysChanged({ tmdbKey: 'a' }, { tmdbKey: 'a' })).toBe(false);
    expect(sourceKeysChanged({}, {})).toBe(false);
  });

  it('ignores whitespace and blank values', () => {
    expect(sourceKeysChanged({ tmdbKey: 'a' }, { tmdbKey: ' a ', omdbKey: '  ' })).toBe(false);
  });

  it('is true when a key is added, changed or removed', () => {
    expect(sourceKeysChanged({}, { tmdbKey: 'a' })).toBe(true);
    expect(sourceKeysChanged({ omdbKey: 'a' }, { omdbKey: 'b' })).toBe(true);
    expect(sourceKeysChanged({ malClientId: 'a' }, {})).toBe(true);
  });
});

describe('saveAndInvalidate', () => {
  it('clears lookups when a key changed', async () => {
    const store = memoryStore();
    store.data.set('lookup:en|lupin|-', {});
    const out = await saveAndInvalidate({ tmdbKey: 'k' }, store, store);
    expect(out.cacheCleared).toBe(true);
    expect(store.data.has('lookup:en|lupin|-')).toBe(false);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ tmdbKey: 'k' });
  });

  it('keeps lookups when nothing changed', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { tmdbKey: 'k' });
    store.data.set('lookup:en|lupin|-', {});
    const out = await saveAndInvalidate({ tmdbKey: 'k' }, store, store);
    expect(out.cacheCleared).toBe(false);
    expect(store.data.has('lookup:en|lupin|-')).toBe(true);
  });
});

describe('saveAndInvalidate thresholds', () => {
  it('keeps stored thresholds when the form saves only keys', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { thresholds: DEFAULT_THRESHOLDS });
    await saveAndInvalidate({ tmdbKey: 'k' }, store, store);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ tmdbKey: 'k', thresholds: DEFAULT_THRESHOLDS });
  });
});

describe('saveAndInvalidate enabled', () => {
  it('keeps the popup switch when the options page saves keys or AI settings', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { enabled: false });
    await saveAndInvalidate({ tmdbKey: 'k' }, store, store);
    await saveAndInvalidate({ aiKey: 'sk' }, store, store);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ tmdbKey: 'k', aiKey: 'sk', enabled: false });
  });

  it('keeps the switch through a threshold save', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { enabled: false });
    await saveThresholdSet('mal', DEFAULT_THRESHOLDS.mal, store);
    expect(store.data.get(SETTINGS_KEY)).toMatchObject({ enabled: false });
  });
});

describe('saveAndInvalidate AI settings', () => {
  it('keeps lookups when only AI settings change', async () => {
    const store = memoryStore();
    store.data.set('lookup:en|lupin|-', {});
    const out = await saveAndInvalidate({ aiKey: 'sk', aiModel: 'deepseek-reasoner' }, store, store);
    expect(out.cacheCleared).toBe(false);
    expect(store.data.has('lookup:en|lupin|-')).toBe(true);
  });
});

describe('saveWithPermission', () => {
  const CUSTOM = 'https://openrouter.ai/api/v1/chat/completions';

  it('saves the DeepSeek URL without asking for a permission', async () => {
    const store = memoryStore();
    const request = vi.fn(async () => true);
    const out = await saveWithPermission({ aiBaseUrl: DEFAULT_AI_BASE_URL, aiKey: 'sk' }, { request }, store, store);
    expect(out.status).toBe('saved');
    expect(request).not.toHaveBeenCalled();
  });

  it('asks for the custom origin before touching storage, and saves when granted', async () => {
    const store = memoryStore();
    const getSpy = vi.spyOn(store, 'get');
    const request = vi.fn(async () => {
      expect(getSpy).not.toHaveBeenCalled();
      return true;
    });
    const pending = saveWithPermission({ aiBaseUrl: CUSTOM }, { request }, store, store);
    expect(request).toHaveBeenCalledWith({ origins: ['https://openrouter.ai/*'] });
    expect((await pending).status).toBe('saved');
    expect(store.data.get(SETTINGS_KEY)).toEqual({ aiBaseUrl: CUSTOM });
  });

  it('refuses to save when the permission is denied', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { aiKey: 'sk' });
    const out = await saveWithPermission({ aiBaseUrl: CUSTOM, aiKey: 'other' }, { request: async () => false }, store, store);
    expect(out).toEqual({ status: 'refused', reason: 'denied' });
    expect(store.data.get(SETTINGS_KEY)).toEqual({ aiKey: 'sk' });
  });

  it('refuses an invalid base URL without asking', async () => {
    const store = memoryStore();
    const request = vi.fn(async () => true);
    const out = await saveWithPermission({ aiBaseUrl: 'http://example.com' }, { request }, store, store);
    expect(out).toEqual({ status: 'refused', reason: 'invalid_url' });
    expect(request).not.toHaveBeenCalled();
  });

  it('goes through a stubbed chrome.permissions', async () => {
    const request = vi.fn(async () => true);
    vi.stubGlobal('chrome', { permissions: { request } });
    const store = memoryStore();
    const out = await saveWithPermission({ aiBaseUrl: CUSTOM }, chrome.permissions, store, store);
    expect(out.status).toBe('saved');
    expect(request).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
