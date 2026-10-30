import { clearLookupCache, type KeyValueStore } from '../background/cache';
import { ensureAiPermission, type PermissionsApi } from './ai';
import type { ThresholdSet, Thresholds } from '../shared/types';
import {
  loadSettings,
  thresholdsOf,
  saveSettings,
  sourceKeysChanged,
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

export async function saveWithPermission(
  draft: Settings,
  permissions: PermissionsApi,
  settingsStore: SettingsStore,
  cacheStore: KeyValueStore,
): Promise<SaveResult> {
  const permission = await ensureAiPermission(draft.aiBaseUrl, permissions);
  if (permission !== 'granted') return { status: 'refused', reason: permission };
  return { status: 'saved', ...(await saveAndInvalidate(draft, settingsStore, cacheStore)) };
}

export async function saveThresholdSet(
  set: keyof Thresholds,
  value: ThresholdSet,
  settingsStore: SettingsStore,
): Promise<Settings> {
  const before = await loadSettings(settingsStore);
  return saveSettings({ ...before, thresholds: { ...thresholdsOf(before), [set]: value } }, settingsStore);
}
