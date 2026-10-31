import { AI_PROVIDERS } from '../../shared/aiProviders';
import { initLocale, locale } from '../../shared/i18n';
import type { AiCachedResponse, AiOk, AiOpinionResponse } from '../../shared/messages';
import { needSummary } from '../../shared/needSummary';
import type { QuickBadge } from '../../shared/quickBadge';
import { aiSettingsOf, type AiSettings, type Settings } from '../../shared/settings';
import type { Kind, TitleInfo } from '../../shared/types';
import type { KeyValueStore } from '../cache';
import type { TasteProfile } from '../taste/tasteProfile';
import { aiCacheKey, readCachedOpinion, type CachedOpinion } from './aiCache';
import { AIError, type AIProvider } from './AIProvider';
import { providerLabel } from './createProvider';

export interface AiServiceDeps {
  store: KeyValueStore;
  loadSettings: () => Promise<Settings>;
  getTasteProfile: (kind: Kind) => Promise<TasteProfile>;
  provider: (config: AiSettings) => AIProvider;
  log?: (message: string) => void;
}

export interface AiService {
  opinion(info: TitleInfo, badge: QuickBadge): Promise<AiOpinionResponse>;
  cached(info: TitleInfo): Promise<AiCachedResponse>;
}

function tasteCount(taste: TasteProfile): number {
  return taste.count.up + taste.count.down;
}

function okResponse(entry: CachedOpinion, fromCache: boolean): AiOk {
  return { status: 'ok', ...entry, fromCache };
}

export function createAiService(deps: AiServiceDeps): AiService {
  const log = deps.log ?? (() => {});
  const inFlight = new Map<string, Promise<AiOpinionResponse>>();

  async function context(info: TitleInfo) {
    const settings = await deps.loadSettings();
    initLocale(settings);
    const config = aiSettingsOf(settings);
    const taste = await deps.getTasteProfile(info.kind);
    return { config, taste, key: aiCacheKey(info.id, info.kind, taste.version, config, locale) };
  }

  async function fetchOpinion(info: TitleInfo, badge: QuickBadge): Promise<AiOpinionResponse> {
    try {
      const { config, taste, key } = await context(info);
      const hit = await readCachedOpinion(deps.store, key);
      if (hit) {
        log(`[sw] ai cache hit ${info.id}`);
        return okResponse(hit, true);
      }
      if (!config.key && AI_PROVIDERS[config.provider].keyRequired) throw new AIError('missing_ai_key');
      log(`[sw] ai fetch ${info.id}`);
      const opinion = await deps.provider(config).opinion({ info, taste, badge, needSummary: needSummary(info) });
      const entry: CachedOpinion = {
        opinion,
        providerLabel: providerLabel(config),
        model: config.model,
        tasteCount: tasteCount(taste),
      };
      await deps.store.set(key, entry);
      return okResponse(entry, false);
    } catch (err) {
      const reason = err instanceof AIError ? err.reason : 'network';
      const detail = err instanceof Error && err.message !== reason ? ` (${err.message})` : '';
      log(`[sw] ai error ${reason}${detail}`);
      return { status: 'error', reason };
    }
  }

  return {
    opinion(info, badge) {
      const pending = inFlight.get(info.id);
      if (pending) return pending;
      const promise = fetchOpinion(info, badge).finally(() => inFlight.delete(info.id));
      inFlight.set(info.id, promise);
      return promise;
    },
    async cached(info) {
      const { key } = await context(info);
      const hit = await readCachedOpinion(deps.store, key);
      return hit ? okResponse(hit, true) : { status: 'none' };
    },
  };
}
