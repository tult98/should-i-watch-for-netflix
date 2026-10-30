import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../src/background/cache';
import { saveAndInvalidate } from '../src/options/save';
import { DEFAULT_THRESHOLDS, SETTINGS_KEY, sourceKeysChanged } from '../src/shared/settings';

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
