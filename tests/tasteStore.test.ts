import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../src/background/cache';
import { RATINGS_KEY, VERSIONS_KEY, createTasteStore, ratedTitleOf } from '../src/background/taste/tasteStore';
import type { AnimeInfo, MovieInfo, SeriesInfo } from '../src/shared/types';

function memoryStore(): KeyValueStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: async (key) => data.get(key),
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
    keys: async () => [...data.keys()],
  };
}

const match = { query: 'x', matchedName: 'x', confidence: 1, source: 'mal' as const };

const anime: AnimeInfo = {
  id: 'mal:1',
  kind: 'anime',
  title: 'Frieren',
  year: 2023,
  genres: ['Fantasy', 'Drama'],
  scores: [],
  match,
  format: 'TV',
  episodes: 28,
  status: 'Finished Airing',
  aired: {},
  studios: ['Madhouse'],
};

const movie: MovieInfo = {
  id: 'tmdb:movie:2',
  kind: 'movie',
  title: 'The Irishman',
  year: 2019,
  genres: ['Crime'],
  scores: [],
  match: { ...match, source: 'tmdb' },
  runtimeMin: 209,
  directors: ['Martin Scorsese'],
  cast: [],
};

const series: SeriesInfo = {
  id: 'tmdb:tv:3',
  kind: 'series',
  title: 'Dark',
  year: 2017,
  genres: ['Mystery'],
  scores: [],
  match: { ...match, source: 'tmdb' },
  episodes: 26,
  status: 'ended',
  creators: ['Baran bo Odar'],
  cast: [],
};

function setup() {
  const store = memoryStore();
  let clock = 1_000;
  const taste = createTasteStore(store, () => clock++);
  return { store, taste };
}

describe('ratedTitleOf', () => {
  it('takes length and makers per kind', () => {
    expect(ratedTitleOf(anime, 'up', 5)).toEqual({
      id: 'mal:1',
      kind: 'anime',
      rating: 'up',
      genres: ['Fantasy', 'Drama'],
      year: 2023,
      length: 28,
      makers: ['Madhouse'],
      ratedAt: 5,
    });
    expect(ratedTitleOf(movie, 'down', 5)).toMatchObject({ length: 209, makers: ['Martin Scorsese'] });
    expect(ratedTitleOf(series, 'up', 5)).toMatchObject({ length: 26, makers: ['Baran bo Odar'] });
  });

  it('drops a zero runtime', () => {
    expect(ratedTitleOf({ ...movie, runtimeMin: 0 }, 'up', 5).length).toBeUndefined();
  });
});

describe('tasteStore', () => {
  it('upserts a rating and bumps only its kind', async () => {
    const { taste, store } = setup();
    expect(await taste.rate(anime, 'up')).toEqual({ rating: 'up', tasteCount: 1 });
    expect(await taste.getRating('mal:1')).toBe('up');
    expect(store.data.get(VERSIONS_KEY)).toEqual({ anime: 1, movie: 0, series: 0 });
    await taste.rate(movie, 'down');
    expect(store.data.get(VERSIONS_KEY)).toEqual({ anime: 1, movie: 1, series: 0 });
    expect((await taste.listRatings()).map((r) => r.id)).toEqual(['mal:1', 'tmdb:movie:2']);
  });

  it('flips a rating in place without duplicating it', async () => {
    const { taste } = setup();
    await taste.rate(anime, 'up');
    expect(await taste.rate(anime, 'down')).toEqual({ rating: 'down', tasteCount: 1 });
    const list = await taste.listRatings();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ rating: 'down', ratedAt: 1_001 });
    expect(await taste.versions()).toEqual({ anime: 2, movie: 0, series: 0 });
  });

  it('removes a rating with null', async () => {
    const { taste } = setup();
    await taste.rate(anime, 'up');
    await taste.rate(series, 'up');
    expect(await taste.rate(anime, null)).toEqual({ rating: null, tasteCount: 0 });
    expect(await taste.getRating('mal:1')).toBeNull();
    expect(await taste.versions()).toEqual({ anime: 2, movie: 0, series: 1 });
  });

  it('does not bump the version when nothing changes', async () => {
    const { taste } = setup();
    await taste.rate(anime, null);
    await taste.rate(anime, 'up');
    await taste.rate(anime, 'up');
    expect(await taste.versions()).toEqual({ anime: 1, movie: 0, series: 0 });
  });

  it('keeps both ratings when two arrive at once', async () => {
    const { taste } = setup();
    await Promise.all([taste.rate(anime, 'up'), taste.rate(movie, 'up'), taste.rate(series, 'down')]);
    expect(await taste.listRatings()).toHaveLength(3);
    expect(await taste.versions()).toEqual({ anime: 1, movie: 1, series: 1 });
  });

  it('clearAll removes ratings, versions and every ai: entry', async () => {
    const { taste, store } = setup();
    await taste.rate(anime, 'up');
    store.data.set('ai:mal:1|anime|v1|deepseek-chat', {});
    store.data.set('lookup:en|frieren|-', {});
    store.data.set('settings', {});
    await taste.clearAll();
    expect([...store.data.keys()].sort()).toEqual(['lookup:en|frieren|-', 'settings']);
    expect(await taste.versions()).toEqual({ anime: 0, movie: 0, series: 0 });
  });

  it('ignores malformed stored data', async () => {
    const { taste, store } = setup();
    store.data.set(RATINGS_KEY, [{ id: 'x' }, null, 'bad']);
    store.data.set(VERSIONS_KEY, { anime: 'two' });
    expect(await taste.listRatings()).toEqual([]);
    expect(await taste.versions()).toEqual({ anime: 0, movie: 0, series: 0 });
  });
});
