import { clearLookupCache, type KeyValueStore } from '../background/cache';
import { ensureAiPermission, type AiDraft, type PermissionsApi } from './ai';
import type { ThresholdSet, Thresholds } from '../shared/types';
import {
  loadSettings,
  thresholdsOf,
  saveSettings,
  sourceKeysChanged,
  type AiProfile,
  type Settings,
  type SettingsStore,
} from '../shared/settings';

export interface SaveOutcome {
  saved: Settings;
  cacheCleared: boolean;
}

export async function saveAndInvalidate(
  draft: Settings,
  settingsStore: SettingsStore,
  cacheStore: KeyValueStore,
): Promise<SaveOutcome> {
  const before = await loadSettings(settingsStore);
  const saved = await saveSettings({ ...before, ...draft }, settingsStore);
  const cacheCleared = sourceKeysChanged(before, saved);
  if (cacheCleared) await clearLookupCache(cacheStore);
  return { saved, cacheCleared };
}

export type SaveResult = ({ status: 'saved' } & SaveOutcome) | { status: 'refused'; reason: 'invalid_url' | 'denied' };

// Makes the draft's provider the active one and merges its profile in, leaving the other providers' profiles alone.
export async function saveWithPermission(
  draft: AiDraft,
  permissions: PermissionsApi,
  settingsStore: SettingsStore,
  cacheStore: KeyValueStore,
): Promise<SaveResult> {
  const permission = await ensureAiPermission(draft.baseUrl, permissions);
  if (permission !== 'granted') return { status: 'refused', reason: permission };
  const before = await loadSettings(settingsStore);
  const profile: AiProfile = {
    format: draft.format,
    baseUrl: draft.baseUrl.trim(),
    model: draft.model.trim(),
    key: draft.key,
  };
  const aiProfiles = { ...before.aiProfiles, [draft.provider]: profile };
  return { status: 'saved', ...(await saveAndInvalidate({ aiProvider: draft.provider, aiProfiles }, settingsStore, cacheStore)) };
}

export async function saveThresholdSet(
  set: keyof Thresholds,
  value: ThresholdSet,
  settingsStore: SettingsStore,
): Promise<Settings> {
  const before = await loadSettings(settingsStore);
  return saveSettings({ ...before, thresholds: { ...thresholdsOf(before), [set]: value } }, settingsStore);
}
