import { clearLookupCache, type KeyValueStore } from '../background/cache';
import {
  loadSettings,
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
  const saved = await saveSettings(draft, settingsStore);
  const cacheCleared = sourceKeysChanged(before, saved);
  if (cacheCleared) await clearLookupCache(cacheStore);
  return { saved, cacheCleared };
}
