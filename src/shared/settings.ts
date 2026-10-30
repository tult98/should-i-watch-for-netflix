export interface Settings {
  malClientId?: string;
  tmdbKey?: string;
  omdbKey?: string;
}

const KEYS = ['malClientId', 'tmdbKey', 'omdbKey'] as const satisfies readonly (keyof Settings)[];

export const SETTINGS_KEY = 'settings';

export interface SettingsStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export function chromeSettingsStore(): SettingsStore {
  return {
    async get(key) {
      const items = await chrome.storage.local.get(key);
      return items[key];
    },
    set: (key, value) => chrome.storage.local.set({ [key]: value }),
  };
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function sanitize(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) return {};
  const clean: Settings = {};
  for (const key of KEYS) {
    const v = cleanString((value as Record<string, unknown>)[key]);
    if (v) clean[key] = v;
  }
  return clean;
}

export async function loadSettings(store: SettingsStore = chromeSettingsStore()): Promise<Settings> {
  return sanitize(await store.get(SETTINGS_KEY));
}

export async function saveSettings(
  settings: Settings,
  store: SettingsStore = chromeSettingsStore(),
): Promise<Settings> {
  const clean = sanitize(settings);
  await store.set(SETTINGS_KEY, clean);
  return clean;
}
