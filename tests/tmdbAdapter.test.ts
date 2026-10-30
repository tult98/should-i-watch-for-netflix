import { describe, expect, it, vi } from 'vitest';
import { createTmdbAdapter, isReadAccessToken, type TmdbMatch } from '../src/background/adapters/TmdbAdapter';
import { RequestError, type FetchFn } from '../src/background/requestQueue';
import irishmanSearch from './fixtures/tmdb-search-irishman.json';
import onePieceSearch from './fixtures/tmdb-search-one-piece.json';
import irishman from './fixtures/tmdb-movie-irishman.json';
import spiritedAway from './fixtures/tmdb-movie-spirited-away.json';
import onePieceLive from './fixtures/tmdb-tv-one-piece-live.json';
import sparseTv from './fixtures/tmdb-tv-ended-sparse.json';

function respondWith(...bodies: unknown[]) {
  const fetch = vi.fn<FetchFn>();
  for (const body of bodies) fetch.mockResolvedValueOnce(new Response(JSON.stringify(body)));
  return fetch;
}

const V3_KEY = 'abc123';
const V4_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';

function match(over: Partial<TmdbMatch>): TmdbMatch {
  return {
    tmdbId: 1,
    mediaType: 'movie',
    query: 'Query',
    matchedName: 'Matched',
    confidence: 0.9,
    animated: false,
    japanese: false,
    ...over,
  };
}

describe('TmdbAdapter auth', () => {
  it('appends api_key for a v3 key', async () => {
    const fetch = respondWith(irishmanSearch);
    await createTmdbAdapter(fetch, V3_KEY).search('The Irishman', undefined, 'en');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/search/multi?query=The+Irishman&language=en&include_adult=false&api_key=abc123',
    );
  });

  it('sends a Bearer header for a v4 read access token', async () => {
    const fetch = respondWith(irishmanSearch);
    await createTmdbAdapter(fetch, V4_TOKEN).search('The Irishman', undefined, 'en');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/search/multi?query=The+Irishman&language=en&include_adult=false',
      { headers: { Authorization: `Bearer ${V4_TOKEN}` } },
    );
    expect(isReadAccessToken(V3_KEY)).toBe(false);
  });

  it('reports 401 as a bad TMDB key', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('{"status_code":7}', { status: 401 }));
    const search = createTmdbAdapter(fetch, V3_KEY).search('X', undefined, 'en');
    await expect(search).rejects.toBeInstanceOf(RequestError);
    await expect(search).rejects.toMatchObject({ reason: 'bad_tmdb_key' });
    const details = createTmdbAdapter(fetch, V3_KEY).details(match({}));
    await expect(details).rejects.toMatchObject({ reason: 'bad_tmdb_key' });
  });

  it('reports other non-OK responses as network errors', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response('{}', { status: 500 }));
    await expect(createTmdbAdapter(fetch, V3_KEY).search('X', undefined, 'en')).rejects.toMatchObject({
      reason: 'network',
    });
  });
});

describe('TmdbAdapter search', () => {
  it('ignores people, matches original_title, and breaks ties by vote_count', async () => {
    const found = await createTmdbAdapter(respondWith(irishmanSearch), V3_KEY).search('The Irishman', undefined, 'vi');
    expect(found).toEqual({
      tmdbId: 398978,
      mediaType: 'movie',
      query: 'The Irishman',
      matchedName: 'The Irishman',
      confidence: 1,
      year: 2019,
      animated: false,
      japanese: false,
    });
  });

  it('lets the card year pick between same-name entries', async () => {
    const found = await createTmdbAdapter(respondWith(irishmanSearch), V3_KEY).search('The Irishman', 1978, 'en');
    expect(found).toMatchObject({ tmdbId: 123, year: 1978 });
  });

  it('exposes the animation and Japanese signals', async () => {
    const adapter = (year?: number) => createTmdbAdapter(respondWith(onePieceSearch), V3_KEY).search('One Piece', year, 'en');
    expect(await adapter(1999)).toMatchObject({ tmdbId: 37854, mediaType: 'tv', animated: true, japanese: true });
    expect(await adapter(2023)).toMatchObject({ tmdbId: 111110, animated: false, japanese: false });
  });

  it('flags original_language ja without JP origin as Japanese', async () => {
    const body = { results: [{ id: 5, media_type: 'movie', title: 'Kimi', original_language: 'ja' }] };
    const found = await createTmdbAdapter(respondWith(body), V3_KEY).search('Kimi', undefined, 'en');
    expect(found).toMatchObject({ japanese: true, animated: false, year: undefined });
  });

  it('retries once in en-US when the profile language finds nothing', async () => {
    const fetch = respondWith({ results: [] }, irishmanSearch);
    const found = await createTmdbAdapter(fetch, V3_KEY).search('The Irishman', undefined, 'de');
    expect(found?.tmdbId).toBe(398978);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![0]).toContain('language=en-US');
  });

  it('does not retry for an English profile, and gives up after the retry', async () => {
    const en = respondWith({ results: [] });
    expect(await createTmdbAdapter(en, V3_KEY).search('Nothing', undefined, 'en-GB')).toBeNull();
    expect(en).toHaveBeenCalledTimes(1);
    const vi2 = respondWith({}, { results: null });
    expect(await createTmdbAdapter(vi2, V3_KEY).search('Nothing', undefined, 'vi')).toBeNull();
    expect(vi2).toHaveBeenCalledTimes(2);
  });
});

describe('TmdbAdapter details', () => {
  it('maps a movie with Vietnamese overview and VN certification', async () => {
    const fetch = respondWith(irishman);
    const m = match({ tmdbId: 398978, query: 'The Irishman', matchedName: 'The Irishman', confidence: 1 });
    const details = await createTmdbAdapter(fetch, V3_KEY).details(m);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/movie/398978?language=vi-VN&append_to_response=credits%2Crelease_dates%2Cexternal_ids%2Ctranslations&api_key=abc123',
    );
    expect(details).toEqual({
      imdbId: 'tt1302006',
      englishName: 'The Irishman',
      info: {
        id: 'tmdb:movie:398978',
        kind: 'movie',
        title: 'Người Đàn Ông Ireland',
        year: 2019,
        synopsis: { text: 'Một sát thủ già nhìn lại cuộc đời mình.', lang: 'vi' },
        genres: ['Hình Sự', 'Chính Kịch'],
        scores: [{ source: 'tmdb', value: 7.6, votes: 8200 }],
        match: { query: 'The Irishman', matchedName: 'The Irishman', confidence: 1, source: 'tmdb' },
        runtimeMin: 209,
        directors: ['Martin Scorsese'],
        cast: ['Robert De Niro', 'Al Pacino', 'Joe Pesci', 'Ray Romano'],
        certification: 'T18',
        releaseDate: '2019-11-01',
      },
    });
  });

  it('falls back to the en-US overview and the US certification', async () => {
    const details = await createTmdbAdapter(respondWith(spiritedAway), V3_KEY).details(match({ tmdbId: 129 }));
    expect(details.info.synopsis).toEqual({ text: 'A girl wanders into a world of spirits.', lang: 'en' });
    expect(details.englishName).toBe('Spirited Away');
    expect(details.imdbId).toBe('tt0245429');
    expect(details.info).toMatchObject({ certification: 'PG', directors: ['Hayao Miyazaki'], cast: ['Rumi Hiiragi'] });
  });

  it('maps a tv series and uses the tv append list', async () => {
    const fetch = respondWith(onePieceLive);
    const details = await createTmdbAdapter(fetch, V4_TOKEN).details(match({ tmdbId: 111110, mediaType: 'tv' }));
    expect(fetch.mock.calls[0]![0]).toBe(
      'https://api.themoviedb.org/3/tv/111110?language=vi-VN&append_to_response=aggregate_credits%2Ccontent_ratings%2Cexternal_ids%2Ctranslations',
    );
    expect(details).toEqual({
      imdbId: 'tt11737520',
      englishName: 'One Piece',
      info: {
        id: 'tmdb:tv:111110',
        kind: 'series',
        title: 'One Piece',
        year: 2023,
        synopsis: { text: 'Monkey D. Luffy ra khơi tìm kho báu.', lang: 'vi' },
        genres: ['Action & Adventure'],
        scores: [{ source: 'tmdb', value: 8.2, votes: 2400 }],
        match: { query: 'Query', matchedName: 'Matched', confidence: 0.9, source: 'tmdb' },
        seasons: 1,
        episodes: 8,
        status: 'ongoing',
        startYear: 2023,
        endYear: undefined,
        creators: ['Matt Owens', 'Steven Maeda'],
        cast: ['Iñaki Godoy', 'Mackenyu', 'Emily Rudd', 'Jacob Romero'],
        certification: 'TV-14',
      },
    });
  });

  it('tolerates a sparse canceled series', async () => {
    const details = await createTmdbAdapter(respondWith(sparseTv), V3_KEY).details(
      match({ tmdbId: 1, mediaType: 'tv', matchedName: 'Sparse Show' }),
    );
    expect(details).toEqual({
      imdbId: undefined,
      englishName: 'Sparse Show',
      info: {
        id: 'tmdb:tv:1',
        kind: 'series',
        title: 'Sparse Show',
        year: 2010,
        synopsis: undefined,
        genres: [],
        scores: [],
        match: { query: 'Query', matchedName: 'Sparse Show', confidence: 0.9, source: 'tmdb' },
        seasons: undefined,
        episodes: undefined,
        status: 'ended',
        startYear: 2010,
        endYear: 2014,
        creators: [],
        cast: [],
        certification: undefined,
      },
    });
  });
});
