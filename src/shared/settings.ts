import type { ThresholdSet, Thresholds } from './types';

export type ThemePref = 'dark' | 'light' | 'system';

export const THEME_PREFS: readonly ThemePref[] = ['dark', 'light', 'system'];

export interface Settings {
  malClientId?: string;
  tmdbKey?: string;
  omdbKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
  aiKey?: string;
  thresholds?: Thresholds;
  enabled?: boolean;
  theme?: ThemePref;
}

const KEYS = ['malClientId', 'tmdbKey', 'omdbKey'] as const satisfies readonly (keyof Settings)[];
const AI_KEYS = ['aiBaseUrl', 'aiModel', 'aiKey'] as const satisfies readonly (keyof Settings)[];

export type SourceKey = (typeof KEYS)[number];
export type AiKey = (typeof AI_KEYS)[number];

export const DEFAULT_AI_BASE_URL = 'https://api.deepseek.com/chat/completions';
export const DEFAULT_AI_MODEL = 'deepseek-chat';

export interface AiSettings {
  baseUrl: string;
  model: string;
  key?: string;
}

// Only https, because the optional host permission the options page can request is https://*/*.
export function parseAiBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function aiSettingsOf(settings: Settings): AiSettings {
  return {
    baseUrl: settings.aiBaseUrl ?? DEFAULT_AI_BASE_URL,
    model: settings.aiModel ?? DEFAULT_AI_MODEL,
    key: settings.aiKey,
  };
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  mal: {
    highly: { score: 8.0, votes: 100_000, rankMax: 500 },
    recommended: { score: 7.5, votes: 30_000 },
    maybe: { score: 7.0 },
    lowVotesBelow: 10_000,
  },
  imdb: {
    highly: { score: 8.0, votes: 100_000 },
    recommended: { score: 7.2, votes: 20_000 },
    maybe: { score: 6.5 },
    lowVotesBelow: 5_000,
  },
  tmdb: {
    highly: { score: 8.0, votes: 5_000 },
    recommended: { score: 7.2, votes: 2_000 },
    maybe: { score: 6.5 },
    lowVotesBelow: 500,
  },
};

export function thresholdsOf(settings: Settings): Thresholds {
  return settings.thresholds ?? DEFAULT_THRESHOLDS;
}

export function enabledOf(settings: Settings): boolean {
  return settings.enabled !== false;
}

export function themeOf(settings: Settings): ThemePref {
  return settings.theme ?? 'system';
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isThresholdSet(value: unknown): value is ThresholdSet {
  if (!isRecord(value)) return false;
  const { highly, recommended, maybe, lowVotesBelow } = value;
  return (
    isRecord(highly) &&
    isNum(highly.score) &&
    isNum(highly.votes) &&
    (highly.rankMax === undefined || isNum(highly.rankMax)) &&
    isRecord(recommended) &&
    isNum(recommended.score) &&
    isNum(recommended.votes) &&
    isRecord(maybe) &&
    isNum(maybe.score) &&
    isNum(lowVotesBelow)
  );
}

function sanitizeThresholds(value: unknown): Thresholds | undefined {
  if (!isRecord(value)) return undefined;
  const pick = (key: keyof Thresholds) => {
    const set = value[key];
    return isThresholdSet(set) ? set : DEFAULT_THRESHOLDS[key];
  };
  return { mal: pick('mal'), imdb: pick('imdb'), tmdb: pick('tmdb') };
}

export function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return {};
  const clean: Settings = {};
  for (const key of [...KEYS, ...AI_KEYS]) {
    const v = cleanString(value[key]);
    if (v) clean[key] = v;
  }
  if (clean.aiBaseUrl && !parseAiBaseUrl(clean.aiBaseUrl)) delete clean.aiBaseUrl;
  const thresholds = sanitizeThresholds(value.thresholds);
  if (thresholds) clean.thresholds = thresholds;
  if (typeof value.enabled === 'boolean') clean.enabled = value.enabled;
  if (THEME_PREFS.includes(value.theme as ThemePref)) clean.theme = value.theme as ThemePref;
  return clean;
}

export function sourceKeysChanged(before: Settings, after: Settings): boolean {
  const a = parseSettings(before);
  const b = parseSettings(after);
  return KEYS.some((key) => a[key] !== b[key]);
}

export async function loadSettings(store: SettingsStore = chromeSettingsStore()): Promise<Settings> {
  return parseSettings(await store.get(SETTINGS_KEY));
}

export async function saveSettings(
  settings: Settings,
  store: SettingsStore = chromeSettingsStore(),
): Promise<Settings> {
  const clean = parseSettings(settings);
  await store.set(SETTINGS_KEY, clean);
  return clean;
}

export async function saveEnabled(enabled: boolean, store: SettingsStore = chromeSettingsStore()): Promise<Settings> {
  return saveSettings({ ...(await loadSettings(store)), enabled }, store);
}

export async function saveTheme(theme: ThemePref, store: SettingsStore = chromeSettingsStore()): Promise<Settings> {
  return saveSettings({ ...(await loadSettings(store)), theme }, store);
}
