import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  DEFAULT_AI_PROVIDER,
  isAiProviderId,
  isApiFormat,
  type AiProviderId,
  type ApiFormat,
} from './aiProviders';
import type { ThresholdSet, Thresholds } from './types';

export type ThemePref = 'dark' | 'light' | 'system';

export const THEME_PREFS: readonly ThemePref[] = ['dark', 'light', 'system'];

export type LanguagePref = 'auto' | 'vi' | 'en';

export const LANGUAGE_PREFS: readonly LanguagePref[] = ['auto', 'vi', 'en'];

export interface AiProfile {
  format: ApiFormat;
  baseUrl: string;
  model: string;
  key?: string;
}

export type AiProfiles = Partial<Record<AiProviderId, AiProfile>>;

export interface Settings {
  malClientId?: string;
  tmdbKey?: string;
  omdbKey?: string;
  aiProvider?: AiProviderId;
  aiProfiles?: AiProfiles;
  thresholds?: Thresholds;
  enabled?: boolean;
  theme?: ThemePref;
  language?: LanguagePref;
}

const KEYS = ['malClientId', 'tmdbKey', 'omdbKey'] as const satisfies readonly (keyof Settings)[];

export type SourceKey = (typeof KEYS)[number];

export interface AiSettings {
  provider: AiProviderId;
  format: ApiFormat;
  baseUrl: string;
  model: string;
  key?: string;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

// Only https, plus plain http for a model running on this machine.
export function parseAiBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:') return url;
    return url.protocol === 'http:' && LOCAL_HOSTS.includes(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

export function presetProfile(provider: AiProviderId): AiProfile {
  const { format, baseUrl, model } = AI_PROVIDERS[provider];
  return { format, baseUrl, model };
}

// A saved profile with each missing field filled from the preset, so a half-saved profile still works.
export function aiProfileOf(settings: Settings, provider: AiProviderId): AiProfile {
  const preset = presetProfile(provider);
  const saved = settings.aiProfiles?.[provider];
  return {
    format: saved?.format ?? preset.format,
    baseUrl: saved?.baseUrl || preset.baseUrl,
    model: saved?.model || preset.model,
    key: saved?.key,
  };
}

export function aiProviderOf(settings: Settings): AiProviderId {
  return settings.aiProvider ?? DEFAULT_AI_PROVIDER;
}

export function aiSettingsOf(settings: Settings): AiSettings {
  const provider = aiProviderOf(settings);
  return { provider, ...aiProfileOf(settings, provider) };
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

export function languageOf(settings: Settings): LanguagePref {
  return settings.language ?? 'auto';
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

function sanitizeAiProfile(value: unknown, provider: AiProviderId): AiProfile | undefined {
  if (!isRecord(value)) return undefined;
  const preset = AI_PROVIDERS[provider];
  const baseUrl = cleanString(value.baseUrl);
  if (!baseUrl || !parseAiBaseUrl(baseUrl)) return undefined;
  const profile: AiProfile = {
    format: isApiFormat(value.format) ? value.format : preset.format,
    baseUrl,
    model: cleanString(value.model) ?? preset.model,
  };
  const key = cleanString(value.key);
  if (key) profile.key = key;
  return profile;
}

function sanitizeAiProfiles(value: unknown): AiProfiles | undefined {
  if (!isRecord(value)) return undefined;
  const profiles: AiProfiles = {};
  for (const provider of AI_PROVIDER_IDS) {
    const profile = sanitizeAiProfile(value[provider], provider);
    if (profile) profiles[provider] = profile;
  }
  return Object.keys(profiles).length > 0 ? profiles : undefined;
}

const DEEPSEEK_HOST = new URL(AI_PROVIDERS.deepseek.baseUrl).host;

// Settings saved before providers existed kept one flat set of AI fields. They become the profile of the provider they pointed at.
function migrateLegacyAi(value: Record<string, unknown>): { provider: AiProviderId; profiles: AiProfiles } | undefined {
  const rawUrl = cleanString(value.aiBaseUrl);
  const url = rawUrl ? parseAiBaseUrl(rawUrl) : null;
  const model = cleanString(value.aiModel);
  const key = cleanString(value.aiKey);
  if (!url && !model && !key) return undefined;
  const provider: AiProviderId = !url || url.host === DEEPSEEK_HOST ? 'deepseek' : 'custom';
  const profile: AiProfile = {
    format: 'openai',
    baseUrl: url ? rawUrl! : AI_PROVIDERS.deepseek.baseUrl,
    model: model ?? AI_PROVIDERS.deepseek.model,
  };
  if (key) profile.key = key;
  return { provider, profiles: { [provider]: profile } };
}

export function parseSettings(value: unknown): Settings {
  if (!isRecord(value)) return {};
  const clean: Settings = {};
  for (const key of KEYS) {
    const v = cleanString(value[key]);
    if (v) clean[key] = v;
  }
  const profiles = sanitizeAiProfiles(value.aiProfiles);
  if (profiles) clean.aiProfiles = profiles;
  if (isAiProviderId(value.aiProvider)) clean.aiProvider = value.aiProvider;
  if (!isRecord(value.aiProfiles)) {
    const legacy = migrateLegacyAi(value);
    if (legacy) {
      clean.aiProfiles = legacy.profiles;
      clean.aiProvider = legacy.provider;
    }
  }
  const thresholds = sanitizeThresholds(value.thresholds);
  if (thresholds) clean.thresholds = thresholds;
  if (typeof value.enabled === 'boolean') clean.enabled = value.enabled;
  if (THEME_PREFS.includes(value.theme as ThemePref)) clean.theme = value.theme as ThemePref;
  if (LANGUAGE_PREFS.includes(value.language as LanguagePref)) clean.language = value.language as LanguagePref;
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

export async function saveLanguage(
  language: LanguagePref,
  store: SettingsStore = chromeSettingsStore(),
): Promise<Settings> {
  return saveSettings({ ...(await loadSettings(store)), language }, store);
}
