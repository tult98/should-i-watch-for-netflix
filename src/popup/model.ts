import type { RatedTitle } from '../background/taste/tasteStore';
import { enabledOf, type Settings } from '../shared/settings';
import { strings } from '../shared/strings.vi';
import type { Kind } from '../shared/types';

const t = strings.popup;
const KEYS = ['malClientId', 'tmdbKey', 'omdbKey', 'aiKey'] as const satisfies readonly (keyof Settings)[];
const KINDS: readonly Kind[] = ['anime', 'movie', 'series'];

export type PopupKey = (typeof KEYS)[number];

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

export function popupModel(settings: Settings, ratings: readonly RatedTitle[]): PopupModel {
  const keys = KEYS.map((key): KeyRow => {
    const set = !!settings[key];
    return set
      ? { key, label: t.keyLabel[key], set, status: t.keySet }
      : { key, label: t.keyLabel[key], set, status: t.keyMissing, note: t.keyMissingNote[key] };
  });
  const hasRatings = ratings.length > 0;
  const counts = KINDS.map((kind) => t.ratingCount(strings.kind[kind], ratings.filter((r) => r.kind === kind).length));
  return { enabled: enabledOf(settings), keys, ratings: hasRatings ? counts.join(' · ') : t.ratingsHint, hasRatings };
}
