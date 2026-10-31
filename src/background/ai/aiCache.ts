import type { Locale } from '../../shared/i18n';
import { parseAiBaseUrl, type AiSettings } from '../../shared/settings';
import type { AIOpinion, Kind } from '../../shared/types';
import type { KeyValueStore } from '../cache';
import { validateOpinion } from './validate';

export interface CachedOpinion {
  opinion: AIOpinion;
  providerLabel: string;
  model: string;
  tasteCount: number;
}

// Provider and host are part of the key so switching provider or endpoint never serves another one's opinion.
export function aiCacheKey(
  id: string,
  kind: Kind,
  tasteVersion: number,
  ai: Pick<AiSettings, 'provider' | 'baseUrl' | 'model'>,
  locale: Locale,
): string {
  const host = parseAiBaseUrl(ai.baseUrl)?.host ?? '';
  return `ai:${id}|${kind}|v${tasteVersion}|${ai.provider}@${host}|${ai.model}|${locale}`;
}

function isCached(value: unknown): value is CachedOpinion {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<CachedOpinion>;
  return (
    typeof v.providerLabel === 'string' &&
    typeof v.model === 'string' &&
    typeof v.tasteCount === 'number' &&
    validateOpinion(JSON.stringify(v.opinion ?? null)).ok
  );
}

export async function readCachedOpinion(store: KeyValueStore, key: string): Promise<CachedOpinion | undefined> {
  const value = await store.get(key);
  return isCached(value) ? value : undefined;
}
