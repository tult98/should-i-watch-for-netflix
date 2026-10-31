import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  aiProfileOf,
  aiSettingsOf,
  parseSettings,
  enabledOf,
  saveEnabled,
  saveLanguage,
  saveTheme,
  languageOf,
  themeOf,
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
  it('defaults to the DeepSeek preset with no key', () => {
    expect(aiSettingsOf({})).toEqual({
      provider: 'deepseek',
      format: 'openai',
      baseUrl: 'https://api.deepseek.com/chat/completions',
      model: 'deepseek-chat',
      key: undefined,
    });
  });

  it('resolves the active profile and fills each missing field from the preset', () => {
    const settings = {
      aiProvider: 'anthropic',
      aiProfiles: {
        anthropic: { format: 'anthropic', baseUrl: 'https://proxy.example/v1/messages', model: '', key: 'k' },
        openai: { format: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'x', key: 'other' },
      },
    } as const;
    expect(aiSettingsOf(settings)).toEqual({
      provider: 'anthropic',
      format: 'anthropic',
      baseUrl: 'https://proxy.example/v1/messages',
      model: 'claude-haiku-4-5',
      key: 'k',
    });
    expect(aiProfileOf({ aiProvider: 'gemini' }, 'gemini')).toMatchObject({ format: 'gemini', baseUrl: expect.stringContaining('v1beta') });
  });

  it('does not carry the key of one provider into another', () => {
    const settings = { aiProvider: 'openai', aiProfiles: { deepseek: { format: 'openai', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'm', key: 'ds' } } } as const;
    expect(aiSettingsOf(settings).key).toBeUndefined();
    expect(aiSettingsOf(settings).baseUrl).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('saves trimmed profiles and drops one whose base URL is not allowed', async () => {
    const store = memoryStore();
    await saveSettings(
      {
        aiProvider: 'custom',
        aiProfiles: {
          custom: { format: 'openai', baseUrl: ' https://llm.example.com/v1/chat/completions ', model: ' m ', key: ' sk ' },
          openai: { format: 'openai', baseUrl: 'http://example.com/v1', model: 'm' },
        },
      },
      store,
    );
    expect(await loadSettings(store)).toEqual({
      aiProvider: 'custom',
      aiProfiles: { custom: { format: 'openai', baseUrl: 'https://llm.example.com/v1/chat/completions', model: 'm', key: 'sk' } },
    });
  });

  it('drops an unknown provider id, an unknown profile key and a bad format', () => {
    const clean = parseSettings({
      aiProvider: 'bogus',
      aiProfiles: {
        bogus: { format: 'openai', baseUrl: 'https://a.example', model: 'm' },
        gemini: { format: 'xml', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: '' },
      },
    });
    expect(clean.aiProvider).toBeUndefined();
    expect(clean.aiProfiles).toEqual({
      gemini: { format: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
    });
    expect(parseSettings({ aiProfiles: { bogus: {} } }).aiProfiles).toBeUndefined();
  });

  it('migrates legacy flat fields on DeepSeek into the deepseek profile', () => {
    expect(parseSettings({ aiKey: ' sk ', aiModel: 'deepseek-reasoner', tmdbKey: 't' })).toEqual({
      tmdbKey: 't',
      aiProvider: 'deepseek',
      aiProfiles: {
        deepseek: { format: 'openai', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-reasoner', key: 'sk' },
      },
    });
    expect(parseSettings({ aiBaseUrl: 'https://api.deepseek.com/chat/completions', aiKey: 'k' }).aiProvider).toBe('deepseek');
  });

  it('migrates a legacy base URL on another host into the custom profile', () => {
    expect(parseSettings({ aiBaseUrl: 'https://openrouter.ai/api/v1/chat/completions', aiModel: 'm', aiKey: 'sk' })).toEqual({
      aiProvider: 'custom',
      aiProfiles: { custom: { format: 'openai', baseUrl: 'https://openrouter.ai/api/v1/chat/completions', model: 'm', key: 'sk' } },
    });
  });

  it('migrates once, then stores no flat fields and ignores them next to profiles', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { aiKey: 'old' });
    const migrated = await loadSettings(store);
    await saveSettings(migrated, store);
    expect(JSON.stringify(store.data.get(SETTINGS_KEY))).not.toContain('aiKey');
    const both = parseSettings({ aiKey: 'old', aiProfiles: { openai: { format: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'm', key: 'new' } } });
    expect(both.aiProfiles?.deepseek).toBeUndefined();
    expect(parseSettings({ aiBaseUrl: 'http://example.com', tmdbKey: 't' })).toEqual({ tmdbKey: 't' });
  });

  it('accepts plain http only for localhost, 127.0.0.1 and ::1 on any port', () => {
    expect(parseAiBaseUrl('http://localhost:11434/v1/chat/completions')?.hostname).toBe('localhost');
    expect(parseAiBaseUrl('http://127.0.0.1:8080/x')?.hostname).toBe('127.0.0.1');
    expect(parseAiBaseUrl('http://[::1]:1234/x')?.hostname).toBe('[::1]');
    expect(parseAiBaseUrl('http://localhost.evil.com/x')).toBeNull();
  });

  it('parses only https base URLs', () => {
    expect(parseAiBaseUrl('https://api.deepseek.com/chat/completions')?.origin).toBe('https://api.deepseek.com');
    expect(parseAiBaseUrl('ftp://x')).toBeNull();
    expect(parseAiBaseUrl('http://example.com')).toBeNull();
    expect(parseAiBaseUrl('not a url')).toBeNull();
  });
});

describe('settings enabled', () => {
  it('is on when unset and off only when stored as false', async () => {
    const store = memoryStore();
    expect(enabledOf(await loadSettings(store))).toBe(true);
    store.data.set(SETTINGS_KEY, { enabled: 'no' });
    expect(enabledOf(await loadSettings(store))).toBe(true);
    store.data.set(SETTINGS_KEY, { enabled: false });
    expect(enabledOf(await loadSettings(store))).toBe(false);
  });

  it('saves the switch without touching the keys', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { tmdbKey: 'k' });
    await saveEnabled(false, store);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ tmdbKey: 'k', enabled: false });
    await saveEnabled(true, store);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ tmdbKey: 'k', enabled: true });
  });
});

describe('settings theme', () => {
  it('defaults to system and keeps only the three known values', async () => {
    const store = memoryStore();
    expect(themeOf(await loadSettings(store))).toBe('system');
    for (const theme of ['dark', 'light', 'system']) {
      store.data.set(SETTINGS_KEY, { theme });
      expect(themeOf(await loadSettings(store))).toBe(theme);
    }
    for (const bad of ['auto', 1, null, true]) {
      store.data.set(SETTINGS_KEY, { theme: bad });
      expect(await loadSettings(store)).toEqual({});
    }
  });

  it('saves the theme over the stored settings', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { tmdbKey: 'k', enabled: false });
    await saveTheme('light', store);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ tmdbKey: 'k', enabled: false, theme: 'light' });
  });
});

describe('settings language', () => {
  it('defaults to auto and keeps only the three known values', async () => {
    const store = memoryStore();
    expect(languageOf(await loadSettings(store))).toBe('auto');
    for (const language of ['auto', 'vi', 'en']) {
      store.data.set(SETTINGS_KEY, { language });
      expect(languageOf(await loadSettings(store))).toBe(language);
    }
    for (const bad of ['fr', 1, null, true]) {
      store.data.set(SETTINGS_KEY, { language: bad });
      expect(await loadSettings(store)).toEqual({});
    }
  });

  it('saves the language over the stored settings', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { tmdbKey: 'k', theme: 'dark' });
    await saveLanguage('en', store);
    expect(store.data.get(SETTINGS_KEY)).toEqual({ tmdbKey: 'k', theme: 'dark', language: 'en' });
  });
});
