import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_THRESHOLDS,
  aiSettingsOf,
  parseAiBaseUrl,
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  thresholdsOf,
  type SettingsStore,
} from '../src/shared/settings';

function memoryStore(): SettingsStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
  };
}

describe('settings', () => {
  it('loads empty settings when nothing is stored', async () => {
    expect(await loadSettings(memoryStore())).toEqual({});
  });

  it('saves under the settings key and loads it back', async () => {
    const store = memoryStore();
    await saveSettings({ malClientId: 'abc123' }, store);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ malClientId: 'abc123' });
    expect(await loadSettings(store)).toEqual({ malClientId: 'abc123' });
  });

  it('trims the client id and drops a blank one', async () => {
    const store = memoryStore();
    expect(await saveSettings({ malClientId: '  abc  ' }, store)).toEqual({ malClientId: 'abc' });
    await saveSettings({ malClientId: '   ' }, store);
    expect(await loadSettings(store)).toEqual({});
  });

  it('ignores malformed stored values', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, 'junk');
    expect(await loadSettings(store)).toEqual({});
    store.data.set(SETTINGS_KEY, { malClientId: 42 });
    expect(await loadSettings(store)).toEqual({});
  });

  it('keeps all three keys, trimmed, and drops blank ones', async () => {
    const store = memoryStore();
    const saved = await saveSettings({ malClientId: ' m ', tmdbKey: ' eyJabc ', omdbKey: '  ' }, store);
    expect(saved).toEqual({ malClientId: 'm', tmdbKey: 'eyJabc' });
    store.data.set(SETTINGS_KEY, { tmdbKey: 'k', omdbKey: 7 });
    expect(await loadSettings(store)).toEqual({ tmdbKey: 'k' });
  });
});

describe('settings thresholds', () => {
  it('falls back to defaults when nothing is stored', async () => {
    expect(thresholdsOf(await loadSettings(memoryStore()))).toBe(DEFAULT_THRESHOLDS);
  });

  it('keeps a valid stored set and replaces a malformed one with its default', async () => {
    const store = memoryStore();
    const mal = { ...DEFAULT_THRESHOLDS.mal, maybe: { score: 6 } };
    store.data.set(SETTINGS_KEY, { thresholds: { mal, imdb: { highly: 'x' } } });
    expect((await loadSettings(store)).thresholds).toEqual({ mal, imdb: DEFAULT_THRESHOLDS.imdb, tmdb: DEFAULT_THRESHOLDS.tmdb });
  });
});

describe('AI settings', () => {
  it('defaults to DeepSeek', () => {
    expect(aiSettingsOf({})).toEqual({ baseUrl: DEFAULT_AI_BASE_URL, model: DEFAULT_AI_MODEL, key: undefined });
    expect(DEFAULT_AI_BASE_URL).toBe('https://api.deepseek.com/chat/completions');
    expect(DEFAULT_AI_MODEL).toBe('deepseek-chat');
  });

  it('saves trimmed AI fields and drops a base URL that is not https', async () => {
    const store = memoryStore();
    await saveSettings({ aiBaseUrl: ' https://openrouter.ai/api/v1/chat/completions ', aiModel: 'm', aiKey: ' sk ' }, store);
    expect(await loadSettings(store)).toEqual({
      aiBaseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      aiModel: 'm',
      aiKey: 'sk',
    });
    await saveSettings({ aiBaseUrl: 'http://localhost:1234/v1/chat/completions' }, store);
    expect(await loadSettings(store)).toEqual({});
  });

  it('parses only https base URLs', () => {
    expect(parseAiBaseUrl('https://api.deepseek.com/chat/completions')?.origin).toBe('https://api.deepseek.com');
    expect(parseAiBaseUrl('ftp://x')).toBeNull();
    expect(parseAiBaseUrl('not a url')).toBeNull();
  });
});
