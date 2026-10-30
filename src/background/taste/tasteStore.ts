import type { RatingResponse } from '../../shared/messages';
import type { Kind, Rating, TitleInfo } from '../../shared/types';
import type { KeyValueStore } from '../cache';

export interface RatedTitle {
  id: string;
  kind: Kind;
  rating: Rating;
  genres: string[];
  year?: number;
  length?: number;
  makers: string[];
  ratedAt: number;
}

export type TasteVersions = Record<Kind, number>;

export type RatingState = RatingResponse;

export const RATINGS_KEY = 'taste:ratings';
export const VERSIONS_KEY = 'taste:versions';
const AI_PREFIX = 'ai:';
const KINDS: readonly Kind[] = ['anime', 'movie', 'series'];

function positive(value: number | undefined): number | undefined {
  return value !== undefined && value > 0 ? value : undefined;
}

export function ratedTitleOf(info: TitleInfo, rating: Rating, ratedAt: number): RatedTitle {
  const base = { id: info.id, kind: info.kind, rating, genres: [...info.genres], year: info.year, ratedAt };
  switch (info.kind) {
    case 'anime':
      return { ...base, length: positive(info.episodes), makers: [...info.studios] };
    case 'movie':
      return { ...base, length: positive(info.runtimeMin), makers: [...info.directors] };
    case 'series':
      return { ...base, length: positive(info.episodes), makers: [...info.creators] };
  }
}

function isRatedTitle(value: unknown): value is RatedTitle {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<RatedTitle>;
  return (
    typeof v.id === 'string' &&
    KINDS.includes(v.kind as Kind) &&
    (v.rating === 'up' || v.rating === 'down') &&
    Array.isArray(v.genres) &&
    Array.isArray(v.makers) &&
    typeof v.ratedAt === 'number'
  );
}

export function parseRatings(value: unknown): RatedTitle[] {
  return Array.isArray(value) ? value.filter(isRatedTitle) : [];
}

export function parseVersions(value: unknown): TasteVersions {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const pick = (kind: Kind) => (typeof v[kind] === 'number' ? (v[kind] as number) : 0);
  return { anime: pick('anime'), movie: pick('movie'), series: pick('series') };
}

export function ratingState(ratings: RatedTitle[], id: string, kind: Kind): RatingState {
  return {
    rating: ratings.find((r) => r.id === id)?.rating ?? null,
    tasteCount: ratings.filter((r) => r.kind === kind).length,
  };
}

export interface TasteStore {
  rate(info: TitleInfo, rating: Rating | null): Promise<RatingState>;
  getRating(id: string): Promise<Rating | null>;
  listRatings(): Promise<RatedTitle[]>;
  versions(): Promise<TasteVersions>;
  clearAll(): Promise<void>;
}

export function createTasteStore(store: KeyValueStore, now: () => number = Date.now): TasteStore {
  // Two quick clicks would otherwise both read the old list and the second write would drop the first.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  const listRatings = async () => parseRatings(await store.get(RATINGS_KEY));
  const versions = async () => parseVersions(await store.get(VERSIONS_KEY));

  return {
    rate: (info, rating) =>
      serial(async () => {
        const ratings = await listRatings();
        const current = ratings.find((r) => r.id === info.id)?.rating ?? null;
        if (current === rating) return ratingState(ratings, info.id, info.kind);
        const next = ratings.filter((r) => r.id !== info.id);
        if (rating) next.push(ratedTitleOf(info, rating, now()));
        const v = await versions();
        await store.set(RATINGS_KEY, next);
        await store.set(VERSIONS_KEY, { ...v, [info.kind]: v[info.kind] + 1 });
        return ratingState(next, info.id, info.kind);
      }),
    async getRating(id) {
      return (await listRatings()).find((r) => r.id === id)?.rating ?? null;
    },
    listRatings,
    versions,
    clearAll: () =>
      serial(async () => {
        await store.remove(RATINGS_KEY);
        await store.remove(VERSIONS_KEY);
        const aiKeys = (await store.keys()).filter((key) => key.startsWith(AI_PREFIX));
        for (const key of aiKeys) await store.remove(key);
      }),
  };
}
