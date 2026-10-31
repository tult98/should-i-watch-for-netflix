import type { RatedTitle } from '../background/taste/tasteStore';
import { AI_PROVIDERS } from '../shared/aiProviders';
import { aiProviderOf, aiProfileOf, enabledOf, type Settings } from '../shared/settings';
import { strings } from '../shared/i18n';
import { providerName } from '../shared/providerName';
import type { Kind } from '../shared/types';

const t = strings.popup;
const KEYS = ['malClientId', 'tmdbKey', 'omdbKey'] as const satisfies readonly (keyof Settings)[];
const KINDS: readonly Kind[] = ['anime', 'movie', 'series'];

export type PopupKey = (typeof KEYS)[number] | 'aiKey';

export interface KeyRow {
  key: PopupKey;
  label: string;
  set: boolean;
  status: string;
  note?: string;
}

export interface PopupModel {
  enabled: boolean;
  keys: KeyRow[];
  ratings: string;
  hasRatings: boolean;
}

function aiKeyRow(settings: Settings): KeyRow {
  const provider = aiProviderOf(settings);
  const label = t.aiLabel(providerName(provider));
  if (aiProfileOf(settings, provider).key) return { key: 'aiKey', label, set: true, status: t.keySet };
  if (!AI_PROVIDERS[provider].keyRequired) return { key: 'aiKey', label, set: true, status: t.keyReady };
  return { key: 'aiKey', label, set: false, status: t.keyMissing, note: t.keyMissingNote.aiKey };
}

export function popupModel(settings: Settings, ratings: readonly RatedTitle[]): PopupModel {
  const keys = KEYS.map((key): KeyRow => {
    const set = !!settings[key];
    return set
      ? { key, label: t.keyLabel[key], set, status: t.keySet }
      : { key, label: t.keyLabel[key], set, status: t.keyMissing, note: t.keyMissingNote[key] };
  });
  keys.push(aiKeyRow(settings));
  const hasRatings = ratings.length > 0;
  const counts = KINDS.map((kind) => t.ratingCount(strings.kind[kind], ratings.filter((r) => r.kind === kind).length));
  return { enabled: enabledOf(settings), keys, ratings: hasRatings ? counts.join(' · ') : t.ratingsHint, hasRatings };
}
