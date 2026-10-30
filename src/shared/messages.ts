import type { QuickBadge } from './quickBadge';
import type { AIErrorReason, AIOpinion, Kind, LookupResult, Rating, TitleInfo } from './types';

export interface LookupRequest {
  type: 'lookup';
  title: string;
  year?: number;
  lang: string;
  netflixId?: string;
}

export type LookupResponse = LookupResult;

export function isLookupRequest(message: unknown): message is LookupRequest {
  if (typeof message !== 'object' || message === null) return false;
  const m = message as Record<string, unknown>;
  return m.type === 'lookup' && typeof m.title === 'string' && typeof m.lang === 'string';
}

export function sendLookup(request: Omit<LookupRequest, 'type'>): Promise<LookupResponse> {
  return send<LookupRequest, LookupResponse>({ type: 'lookup', ...request });
}

export interface AiOpinionRequest {
  type: 'ai-opinion';
  info: TitleInfo;
  badge: QuickBadge;
}

export interface AiCachedRequest {
  type: 'ai-cached';
  info: TitleInfo;
}

export interface RateRequest {
  type: 'rate';
  info: TitleInfo;
  rating: Rating | null;
}

export interface RatingGetRequest {
  type: 'rating-get';
  id: string;
  kind: Kind;
}

export interface RatingResponse {
  rating: Rating | null;
  tasteCount: number;
}

export interface OpenOptionsRequest {
  type: 'open-options';
}

export interface AiOk {
  status: 'ok';
  opinion: AIOpinion;
  providerLabel: string;
  model: string;
  tasteCount: number;
  fromCache: boolean;
}

export type AiOpinionResponse = AiOk | { status: 'error'; reason: AIErrorReason };
export type AiCachedResponse = AiOk | { status: 'none' };

function hasInfo(m: Record<string, unknown>): boolean {
  const info = m.info as Record<string, unknown> | null | undefined;
  return typeof info === 'object' && info !== null && typeof info.id === 'string' && typeof info.kind === 'string';
}

function asRecord(message: unknown): Record<string, unknown> | null {
  return typeof message === 'object' && message !== null ? (message as Record<string, unknown>) : null;
}

export function isAiOpinionRequest(message: unknown): message is AiOpinionRequest {
  const m = asRecord(message);
  return !!m && m.type === 'ai-opinion' && hasInfo(m) && typeof m.badge === 'object' && m.badge !== null;
}

export function isAiCachedRequest(message: unknown): message is AiCachedRequest {
  const m = asRecord(message);
  return !!m && m.type === 'ai-cached' && hasInfo(m);
}

export function isRateRequest(message: unknown): message is RateRequest {
  const m = asRecord(message);
  return !!m && m.type === 'rate' && hasInfo(m) && (m.rating === 'up' || m.rating === 'down' || m.rating === null);
}

const KINDS: readonly unknown[] = ['anime', 'movie', 'series'];

export function isRatingGetRequest(message: unknown): message is RatingGetRequest {
  const m = asRecord(message);
  return !!m && m.type === 'rating-get' && typeof m.id === 'string' && KINDS.includes(m.kind);
}

export function isOpenOptionsRequest(message: unknown): message is OpenOptionsRequest {
  return asRecord(message)?.type === 'open-options';
}

function send<Req, Res>(message: Req): Promise<Res> {
  try {
    // sendMessage throws synchronously once the extension context is invalidated.
    return Promise.resolve(chrome.runtime.sendMessage<Req, Res>(message));
  } catch (err) {
    return Promise.reject(err);
  }
}

export function sendAiOpinion(info: TitleInfo, badge: QuickBadge): Promise<AiOpinionResponse> {
  return send<AiOpinionRequest, AiOpinionResponse>({ type: 'ai-opinion', info, badge });
}

export function sendAiCached(info: TitleInfo): Promise<AiCachedResponse> {
  return send<AiCachedRequest, AiCachedResponse>({ type: 'ai-cached', info });
}

export function sendOpenOptions(): Promise<void> {
  return send<OpenOptionsRequest, void>({ type: 'open-options' });
}

export function sendRate(info: TitleInfo, rating: Rating | null): Promise<RatingResponse> {
  return send<RateRequest, RatingResponse>({ type: 'rate', info, rating });
}

export function sendRatingGet(id: string, kind: Kind): Promise<RatingResponse> {
  return send<RatingGetRequest, RatingResponse>({ type: 'rating-get', id, kind });
}
