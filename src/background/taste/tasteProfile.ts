import type { Kind } from '../../shared/types';
import { chromeLocalStore } from '../cache';
import { createTasteStore, type RatedTitle, type TasteStore } from './tasteStore';

export interface TasteProfile {
  kind: Kind;
  version: number;
  count: { up: number; down: number };
  likedGenres: string[];
  dislikedGenres: string[];
  preferredLength?: number;
  era?: 'new' | 'old' | 'mixed';
  topMakers?: string[];
}

export const MAX_GENRES = 6;
export const MAX_MAKERS = 3;
const MIN_LENGTHS = 2;
const MIN_YEARS = 3;
const NEW_MAX_AGE = 10;
const NEW_SHARE = 0.7;
const OLD_SHARE = 0.3;

function byCountThenName([a, x]: [string, number], [b, y]: [string, number]): number {
  return Math.abs(y) - Math.abs(x) || a.localeCompare(b);
}

function genreNets(ratings: RatedTitle[]): Map<string, number> {
  const nets = new Map<string, number>();
  for (const r of ratings) {
    for (const genre of new Set(r.genres)) nets.set(genre, (nets.get(genre) ?? 0) + (r.rating === 'up' ? 1 : -1));
  }
  return nets;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function eraOf(years: number[], nowMs: number): TasteProfile['era'] {
  if (years.length < MIN_YEARS) return undefined;
  const currentYear = new Date(nowMs).getFullYear();
  const share = years.filter((y) => currentYear - y <= NEW_MAX_AGE).length / years.length;
  if (share >= NEW_SHARE) return 'new';
  if (share <= OLD_SHARE) return 'old';
  return 'mixed';
}

// A maker liked only once says little, so only repeat makers count.
function topMakers(liked: RatedTitle[]): string[] {
  const counts = new Map<string, number>();
  for (const r of liked) for (const m of new Set(r.makers)) counts.set(m, (counts.get(m) ?? 0) + 1);
  return [...counts]
    .filter(([, n]) => n >= 2)
    .sort(byCountThenName)
    .slice(0, MAX_MAKERS)
    .map(([name]) => name);
}

export function buildProfile(all: RatedTitle[], kind: Kind, version: number, nowMs: number): TasteProfile {
  const ratings = all.filter((r) => r.kind === kind);
  const liked = ratings.filter((r) => r.rating === 'up');
  const nets = [...genreNets(ratings)].sort(byCountThenName);
  const profile: TasteProfile = {
    kind,
    version,
    count: { up: liked.length, down: ratings.length - liked.length },
    likedGenres: nets.filter(([, n]) => n > 0).slice(0, MAX_GENRES).map(([g]) => g),
    dislikedGenres: nets.filter(([, n]) => n < 0).slice(0, MAX_GENRES).map(([g]) => g),
  };
  const lengths = liked.flatMap((r) => (r.length !== undefined ? [r.length] : []));
  if (lengths.length >= MIN_LENGTHS) profile.preferredLength = median(lengths);
  const era = eraOf(liked.flatMap((r) => (r.year !== undefined ? [r.year] : [])), nowMs);
  if (era) profile.era = era;
  const makers = topMakers(liked);
  if (makers.length) profile.topMakers = makers;
  return profile;
}

export async function getTasteProfile(
  kind: Kind,
  taste: TasteStore = createTasteStore(chromeLocalStore()),
  now: () => number = Date.now,
): Promise<TasteProfile> {
  const [ratings, versions] = await Promise.all([taste.listRatings(), taste.versions()]);
  return buildProfile(ratings, kind, versions[kind], now());
}
