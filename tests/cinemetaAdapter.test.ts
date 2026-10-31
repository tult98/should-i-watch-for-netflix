import { describe, expect, it, vi } from 'vitest';
import type { FilmMatch } from '../src/background/adapters/FilmAdapter';
import { createCinemetaAdapter } from '../src/background/adapters/CinemetaAdapter';
import { RequestError, type FetchFn } from '../src/background/requestQueue';
import breakingBadMeta from './fixtures/cinemeta-meta-breaking-bad.json';
import interstellarMeta from './fixtures/cinemeta-meta-interstellar.json';
import noRatingMeta from './fixtures/cinemeta-meta-no-rating.json';
import onePieceAnimeMeta from './fixtures/cinemeta-meta-one-piece-anime.json';
import onePieceLiveMeta from './fixtures/cinemeta-meta-one-piece-live.json';
import interstellarSearch from './fixtures/cinemeta-search-movie-interstellar.json';
import onePieceMovieSearch from './fixtures/cinemeta-search-movie-one-piece.json';
import emptySearch from './fixtures/cinemeta-search-series-empty.json';
import breakingBadSearch from './fixtures/cinemeta-search-series-breaking-bad.json';
import onePieceSeriesSearch from './fixtures/cinemeta-search-series-one-piece.json';

const BASE = 'https://v3-cinemeta.strem.io';

function route(table: Record<string, unknown>) {
  return vi.fn<FetchFn>(async (url) => {
    const path = url.slice(BASE.length);
    if (!(path in table)) throw new Error(`unexpected request ${path}`);
    return new Response(JSON.stringify(table[path]));
  });
}

const interstellarRoutes = {
  '/catalog/movie/top/search=Interstellar.json': interstellarSearch,
  '/catalog/series/top/search=Interstellar.json': emptySearch,
  '/meta/movie/tt0816692.json': interstellarMeta,
};

const onePieceRoutes = {
  '/catalog/movie/top/search=One%20Piece.json': onePieceMovieSearch,
  '/catalog/series/top/search=One%20Piece.json': onePieceSeriesSearch,
  '/meta/series/tt0388629.json': onePieceAnimeMeta,
  '/meta/series/tt11737520.json': onePieceLiveMeta,
};

function match(over: Partial<FilmMatch>): FilmMatch {
  return {
    id: 'tt0816692',
    mediaType: 'movie',
    query: 'Interstellar',
    matchedName: 'Interstellar',
    confidence: 1,
    animated: false,
    japanese: false,
    ...over,
  };
}

describe('CinemetaAdapter search', () => {
  it('searches both catalogs by title only and matches the year from releaseInfo', async () => {
    const fetch = route(interstellarRoutes);
    const found = await createCinemetaAdapter(fetch).search('Interstellar', 2014, 'vi');
    expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual([
      `${BASE}/catalog/movie/top/search=Interstellar.json`,
      `${BASE}/catalog/series/top/search=Interstellar.json`,
      `${BASE}/meta/movie/tt0816692.json`,
    ]);
    expect(found).toEqual({
      id: 'tt0816692',
      mediaType: 'movie',
      query: 'Interstellar',
      matchedName: 'Interstellar',
      confidence: 1,
      year: 2014,
      animated: false,
      japanese: false,
    });
  });

  it('reads the first year of a series range', async () => {
    const fetch = route({
      '/catalog/movie/top/search=Breaking%20Bad.json': { metas: [] },
      '/catalog/series/top/search=Breaking%20Bad.json': breakingBadSearch,
      '/meta/series/tt0903747.json': breakingBadMeta,
    });
    expect(await createCinemetaAdapter(fetch).search('Breaking Bad', 2008, 'en')).toMatchObject({
      id: 'tt0903747',
      mediaType: 'tv',
      year: 2008,
      confidence: 1,
    });
  });

  it('drops a year that disagrees with the title', async () => {
    const fetch = route(interstellarRoutes);
    expect(await createCinemetaAdapter(fetch).search('Interstellar', 1978, 'en')).toBeNull();
  });

  it('returns null when neither catalog has the title', async () => {
    const fetch = route({
      '/catalog/movie/top/search=Nothing.json': { metas: [] },
      '/catalog/series/top/search=Nothing.json': { metas: [] },
    });
    expect(await createCinemetaAdapter(fetch).search('Nothing', undefined, 'en')).toBeNull();
  });

  it('separates the anime from the live action with the year, and flags animation and Japan', async () => {
    const adapter = () => createCinemetaAdapter(route(onePieceRoutes));
    expect(await adapter().search('One Piece', 1999, 'en')).toMatchObject({
      id: 'tt0388629',
      mediaType: 'tv',
      animated: true,
      japanese: true,
    });
    // The live action also lists Japan among its countries, so only the Animation genre keeps it off the anime route.
    expect(await adapter().search('One Piece', 2023, 'en')).toMatchObject({
      id: 'tt11737520',
      animated: false,
      japanese: true,
    });
  });

  it('prefers the first result when no year breaks the tie', async () => {
    expect(await createCinemetaAdapter(route(onePieceRoutes)).search('One Piece', undefined, 'en')).toMatchObject({
      id: 'tt0388629',
    });
  });

  it('encodes the title into the path', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response(JSON.stringify({ metas: [] })));
    await createCinemetaAdapter(fetch).search('Fast & Furious 9/11?', undefined, 'en');
    expect(fetch).toHaveBeenCalledWith(`${BASE}/catalog/movie/top/search=Fast%20%26%20Furious%209%2F11%3F.json`);
  });

  it('maps an HTTP error to a network RequestError', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('', { status: 500 }));
    await expect(createCinemetaAdapter(fetch).search('X', undefined, 'en')).rejects.toBeInstanceOf(RequestError);
    await expect(createCinemetaAdapter(fetch).search('X', undefined, 'en')).rejects.toMatchObject({ reason: 'network' });
  });

  it('fails when the best candidate has no meta', async () => {
    const fetch = route({ ...interstellarRoutes, '/meta/movie/tt0816692.json': { meta: {} } });
    await expect(createCinemetaAdapter(fetch).search('Interstellar', 2014, 'en')).rejects.toMatchObject({
      reason: 'network',
    });
  });
});

describe('CinemetaAdapter details', () => {
  it('maps a movie with an IMDb score and no vote count', async () => {
    const details = await createCinemetaAdapter(route(interstellarRoutes)).details(match({}));
    expect(details.imdbId).toBe('tt0816692');
    expect(details.englishName).toBe('Interstellar');
    expect(details.info).toMatchObject({
      id: 'imdb:tt0816692',
      kind: 'movie',
      title: 'Interstellar',
      year: 2014,
      genres: ['Adventure', 'Sci-Fi'],
      scores: [{ source: 'imdb', value: 8.7 }],
      match: { query: 'Interstellar', matchedName: 'Interstellar', confidence: 1, source: 'cinemeta' },
      runtimeMin: 169,
      directors: ['Christopher Nolan'],
      cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
      releaseDate: '2014-11-07',
    });
    expect(details.info.synopsis).toEqual({ text: expect.stringContaining('dystopian future'), lang: 'en' });
    expect(details.info.scores[0]).not.toHaveProperty('votes');
  });

  it('maps a series with seasons, episodes, status and creators', async () => {
    const fetch = route({ '/meta/series/tt0903747.json': breakingBadMeta });
    const details = await createCinemetaAdapter(fetch).details(
      match({ id: 'tt0903747', mediaType: 'tv', query: 'Breaking Bad', matchedName: 'Breaking Bad' }),
    );
    expect(details.info).toMatchObject({
      id: 'imdb:tt0903747',
      kind: 'series',
      title: 'Breaking Bad',
      year: 2008,
      scores: [{ source: 'imdb', value: 9.5 }],
      seasons: 5,
      episodes: 62,
      status: 'ended',
      startYear: 2008,
      endYear: 2013,
      creators: ['Vince Gilligan'],
      cast: ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn'],
    });
  });

  it('keeps a running series open ended', async () => {
    const fetch = route(onePieceRoutes);
    const details = await createCinemetaAdapter(fetch).details(match({ id: 'tt11737520', mediaType: 'tv' }));
    expect(details.info).toMatchObject({ status: 'ongoing', startYear: 2023, endYear: undefined });
  });

  it('survives a title with no rating, year, country or runtime', async () => {
    const fetch = route({ '/meta/movie/tt44733971.json': noRatingMeta });
    const details = await createCinemetaAdapter(fetch).details(match({ id: 'tt44733971', year: 2025 }));
    expect(details.info).toMatchObject({
      title: 'ONE PIECE FILM GOD VALLEY',
      year: 2025,
      scores: [],
      runtimeMin: undefined,
      releaseDate: undefined,
      directors: [],
      cast: [],
    });
  });

  it('reuses the meta that search already fetched', async () => {
    const fetch = route(interstellarRoutes);
    const adapter = createCinemetaAdapter(fetch);
    const found = await adapter.search('Interstellar', 2014, 'en');
    await adapter.details(found!);
    expect(fetch.mock.calls.filter(([url]) => url.includes('/meta/'))).toHaveLength(1);
  });

  it('retries a meta that failed instead of caching the failure', async () => {
    const fetch = vi.fn<FetchFn>();
    fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(interstellarMeta)));
    const adapter = createCinemetaAdapter(fetch);
    await expect(adapter.details(match({}))).rejects.toMatchObject({ reason: 'network' });
    expect((await adapter.details(match({}))).info.title).toBe('Interstellar');
  });
});
