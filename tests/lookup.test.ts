import { describe, expect, it, vi } from 'vitest';
import type { AnimeAdapter } from '../src/background/adapters/AnimeAdapter';
import type { OmdbAdapter, OmdbResult } from '../src/background/adapters/OmdbAdapter';
import type { FilmAdapter, FilmDetails, FilmMatch } from '../src/background/adapters/FilmAdapter';
import type { LookupCache } from '../src/background/cache';
import { createLookup } from '../src/background/lookup';
import { RequestError } from '../src/background/requestQueue';
import type { Settings } from '../src/shared/settings';
import type { AnimeInfo, LookupResult, MovieInfo } from '../src/shared/types';

function animeInfo(over: Partial<AnimeInfo> = {}): AnimeInfo {
  return {
    id: 'mal:21',
    kind: 'anime',
    format: 'TV',
    scores: [{ source: 'mal', value: 8.7, votes: 1000 }],
    match: { query: 'One Piece', matchedName: 'One Piece', confidence: 1, source: 'mal' },
    ...over,
  } as AnimeInfo;
}

const anime = animeInfo();

function tmdbMatch(over: Partial<FilmMatch> = {}): FilmMatch {
  return {
    id: '398978',
    mediaType: 'movie',
    query: 'The Irishman',
    matchedName: 'The Irishman',
    confidence: 1,
    year: 2019,
    animated: false,
    japanese: false,
    ...over,
  };
}

function tmdbDetails(over: Partial<FilmDetails> = {}): FilmDetails {
  const info = {
    id: 'tmdb:movie:398978',
    kind: 'movie',
    scores: [{ source: 'tmdb', value: 7.6, votes: 8200 }],
  } as MovieInfo;
  return { info, imdbId: 'tt1302006', englishName: 'The Irishman', ...over };
}

const omdbOk: OmdbResult = {
  status: 'ok',
  scores: [
    { source: 'imdb', value: 7.8, votes: 1234567 },
    { source: 'rt', value: 95 },
  ],
};

interface Options {
  settings?: Settings;
  anime?: AnimeAdapter['search'];
  tmdbSearch?: FilmAdapter['search'];
  tmdbDetails?: FilmAdapter['details'];
  omdb?: OmdbAdapter['scores'];
}

function setup(options: Options = {}) {
  const data = new Map<string, LookupResult>();
  const cache: LookupCache = {
    get: async (key) => data.get(key),
    set: async (key, result) => {
      if (result.status !== 'error') data.set(key, result);
    },
  };
  const search = options.anime ?? (async () => anime);
  const anilist = { search: vi.fn(search) };
  const official = { search: vi.fn(search) };
  const malOfficial = vi.fn((_clientId: string) => official);
  const tmdbAdapter = {
    search: vi.fn(options.tmdbSearch ?? (async () => null)),
    details: vi.fn(options.tmdbDetails ?? (async () => tmdbDetails())),
  };
  const tmdb = vi.fn((_key: string) => tmdbAdapter);
  const cinemeta = vi.fn(() => tmdbAdapter);
  const omdbAdapter = { scores: vi.fn(options.omdb ?? (async () => omdbOk)) };
  const omdb = vi.fn((_key: string) => omdbAdapter);
  const current = { settings: options.settings ?? {} };
  const logs: string[] = [];
  const lookup = createLookup({
    cache,
    loadSettings: async () => current.settings,
    anilist,
    malOfficial,
    tmdb,
    cinemeta,
    omdb,
    log: (m) => logs.push(m),
  });
  return { lookup, anilist, official, malOfficial, tmdb, cinemeta, tmdbAdapter, omdb, omdbAdapter, current, logs, data };
}

const request = { type: 'lookup' as const, title: 'One Piece', lang: 'en' };
const irishman = { ...request, title: 'The Irishman' };
const keys = { tmdbKey: 'tmdb-key', omdbKey: 'omdb-key' };

describe('lookup with no keys', () => {
  it('fetches on a miss and reads the cache on the second call', async () => {
    const { lookup, anilist, tmdb, cinemeta, logs } = setup();
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(anilist.search).toHaveBeenCalledTimes(1);
    expect(anilist.search).toHaveBeenCalledWith('One Piece', undefined);
    expect(tmdb).not.toHaveBeenCalled();
    expect(cinemeta).toHaveBeenCalledTimes(1);
    expect(logs).toEqual([
      '[sw] fetch cinemeta One Piece',
      '[sw] fetch anilist One Piece',
      '[sw] route anime One Piece',
      '[sw] cache hit lookup:vi|en|one piece|-',
    ]);
  });

  it('caches a no_match when neither source knows the title', async () => {
    const { lookup, anilist, logs } = setup({ anime: async () => null });
    expect(await lookup(request)).toEqual({ status: 'no_match' });
    await lookup(request);
    expect(anilist.search).toHaveBeenCalledTimes(1);
    expect(logs).toContain('[sw] route none One Piece');
  });

  it('answers a live action film from Cinemeta with its IMDb score, without TMDB or OMDb', async () => {
    const imdbOnly = tmdbDetails({
      info: { id: 'imdb:tt1302006', kind: 'movie', scores: [{ source: 'imdb', value: 7.8 }] } as MovieInfo,
    });
    const { lookup, tmdb, cinemeta, tmdbAdapter, omdb, logs } = setup({
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch(),
      tmdbDetails: async () => imdbOnly,
    });
    expect(await lookup(irishman)).toEqual({ status: 'match', info: imdbOnly.info });
    expect(cinemeta).toHaveBeenCalledTimes(1);
    expect(tmdb).not.toHaveBeenCalled();
    expect(omdb).not.toHaveBeenCalled();
    expect(tmdbAdapter.search).toHaveBeenCalledWith('The Irishman', undefined, 'en');
    expect(logs).toContain('[sw] fetch cinemeta The Irishman');
    expect(logs).toContain('[sw] route tmdb The Irishman');
  });

  it('keeps an animated Japanese series on AniList and a live action remake on Cinemeta', async () => {
    const live = tmdbDetails({
      info: { id: 'imdb:tt11737520', kind: 'series', scores: [{ source: 'imdb', value: 8.3 }] } as unknown as MovieInfo,
    });
    const animated = setup({
      tmdbSearch: async () => tmdbMatch({ mediaType: 'tv', animated: true, japanese: true }),
    });
    expect(await animated.lookup(request)).toEqual({ status: 'match', info: anime });
    expect(animated.tmdbAdapter.details).not.toHaveBeenCalled();

    // The live action One Piece also lists Japan, so only the animation flag separates it.
    const remake = setup({
      tmdbSearch: async () => tmdbMatch({ mediaType: 'tv', animated: false, japanese: true }),
      tmdbDetails: async () => live,
    });
    expect(await remake.lookup(request)).toEqual({ status: 'match', info: live.info });
  });

  it('uses the anime answer when Cinemeta fails, and reports the failure when there is none', async () => {
    const failing = async (): Promise<FilmMatch | null> => {
      throw new RequestError('network');
    };
    const withAnime = setup({ tmdbSearch: failing });
    expect(await withAnime.lookup(request)).toEqual({ status: 'match', info: anime });
    expect(withAnime.logs).toContain('[sw] cinemeta failed network, using anime');
    expect(withAnime.data.size).toBe(0);

    const without = setup({ anime: async () => null, tmdbSearch: failing });
    expect(await without.lookup(request)).toEqual({ status: 'error', reason: 'network' });
    expect(without.data.size).toBe(0);
  });

  it('still answers a live action film when AniList fails, but not an animated one', async () => {
    const failing = async (): Promise<AnimeInfo | null> => {
      throw new RequestError('network');
    };
    const live = setup({ anime: failing, tmdbSearch: async () => tmdbMatch() });
    expect((await live.lookup(irishman)).status).toBe('match');
    expect(live.data.size).toBe(1);

    const animated = setup({ anime: failing, tmdbSearch: async () => tmdbMatch({ animated: true }) });
    expect(await animated.lookup(irishman)).toEqual({ status: 'error', reason: 'network' });
    const nothing = setup({ anime: failing });
    expect(await nothing.lookup(irishman)).toEqual({ status: 'error', reason: 'network' });
  });

  it('replaces the Cinemeta IMDb score with the OMDb one when an OMDb key is set', async () => {
    const cinemetaOnly = tmdbDetails({
      info: {
        id: 'imdb:tt1302006',
        kind: 'movie',
        scores: [{ source: 'imdb', value: 7.8 }],
      } as MovieInfo,
    });
    const { lookup, cinemeta, omdbAdapter } = setup({
      settings: { omdbKey: 'omdb-key' },
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch(),
      tmdbDetails: async () => cinemetaOnly,
    });
    const result = await lookup(irishman);
    expect(cinemeta).toHaveBeenCalledTimes(1);
    expect(omdbAdapter.scores).toHaveBeenCalledWith('tt1302006');
    expect(result.status === 'match' && result.info.scores).toEqual([
      { source: 'imdb', value: 7.8, votes: 1234567 },
      { source: 'rt', value: 95 },
    ]);
  });

  it('maps a rate limit to an uncached error', async () => {
    const { lookup, anilist, data } = setup({
      anime: async () => {
        throw new RequestError('rate_limited');
      },
    });
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'rate_limited' });
    expect(data.size).toBe(0);
    await lookup(request);
    expect(anilist.search).toHaveBeenCalledTimes(2);
  });

  it('maps an unexpected failure to a network error', async () => {
    const { lookup } = setup({
      anime: async () => {
        throw new SyntaxError('Unexpected token');
      },
    });
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'network' });
  });

  it('shares one search between concurrent identical lookups', async () => {
    const { lookup, anilist } = setup();
    await Promise.all([lookup(request), lookup({ ...request, title: 'ONE PIECE!' })]);
    expect(anilist.search).toHaveBeenCalledTimes(1);
  });

  it('uses the official MAL API when a client id is set', async () => {
    const { lookup, anilist, official, malOfficial, logs } = setup({ settings: { malClientId: 'abc' } });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(malOfficial).toHaveBeenCalledWith('abc');
    expect(official.search).toHaveBeenCalledWith('One Piece', undefined);
    expect(anilist.search).not.toHaveBeenCalled();
    expect(logs).toEqual(['[sw] fetch cinemeta One Piece', '[sw] fetch mal-official One Piece', '[sw] route anime One Piece']);
  });

  it('falls back to AniList for titles shorter than 3 characters', async () => {
    const { lookup, anilist, official, logs } = setup({ settings: { malClientId: 'abc' } });
    await lookup({ ...request, title: '86' });
    expect(official.search).not.toHaveBeenCalled();
    expect(anilist.search).toHaveBeenCalledWith('86', undefined);
    expect(logs).toContain('[sw] fetch anilist 86');
  });

  it('retries with the new source after a bad client id is fixed', async () => {
    const { lookup, official, anilist, current } = setup({ settings: { malClientId: 'wrong' } });
    official.search.mockRejectedValueOnce(new RequestError('bad_mal_client_id'));
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'bad_mal_client_id' });
    current.settings = {};
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(anilist.search).toHaveBeenCalledTimes(1);
  });
});

describe('lookup with TMDB', () => {
  it('starts the anime and TMDB searches in parallel', async () => {
    let releaseAnime: (value: AnimeInfo | null) => void = () => {};
    const { lookup, anilist, tmdbAdapter, tmdb, cinemeta } = setup({
      settings: keys,
      anime: () => new Promise((resolve) => (releaseAnime = resolve)),
      tmdbSearch: async () => tmdbMatch(),
    });
    const pending = lookup(irishman);
    await vi.waitFor(() => expect(anilist.search).toHaveBeenCalled());
    expect(tmdb).toHaveBeenCalledWith('tmdb-key');
    expect(cinemeta).not.toHaveBeenCalled();
    expect(tmdbAdapter.search).toHaveBeenCalledWith('The Irishman', undefined, 'en');
    releaseAnime(null);
    expect((await pending).status).toBe('match');
  });

  it('routes a live action film to TMDB and merges OMDb scores', async () => {
    const { lookup, omdbAdapter, logs } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch(),
    });
    const result = await lookup(irishman);
    expect(omdbAdapter.scores).toHaveBeenCalledWith('tt1302006');
    expect(result).toEqual({
      status: 'match',
      info: {
        ...tmdbDetails().info,
        scores: [
          { source: 'tmdb', value: 7.6, votes: 8200 },
          { source: 'imdb', value: 7.8, votes: 1234567 },
          { source: 'rt', value: 95 },
        ],
      },
    });
    expect(logs).toContain('[sw] route tmdb The Irishman');
  });

  it('prefers a live action TMDB match over a confident MAL match', async () => {
    const { lookup } = setup({ settings: keys, tmdbSearch: async () => tmdbMatch({ mediaType: 'tv' }) });
    const result = await lookup(request);
    expect(result.status === 'match' && result.info.kind).toBe('movie');
  });

  it('prefers a Japanese live action TMDB match over a confident MAL match', async () => {
    const { lookup } = setup({
      settings: keys,
      tmdbSearch: async () => tmdbMatch({ mediaType: 'tv', japanese: true, animated: false }),
    });
    const result = await lookup(request);
    expect(result.status === 'match' && result.info.kind).toBe('movie');
  });

  it('keeps an anime TV series on MAL without calling TMDB details or OMDb', async () => {
    const { lookup, tmdbAdapter, omdbAdapter } = setup({
      settings: keys,
      tmdbSearch: async () => tmdbMatch({ mediaType: 'tv', animated: true, japanese: true }),
    });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(tmdbAdapter.details).not.toHaveBeenCalled();
    expect(omdbAdapter.scores).not.toHaveBeenCalled();
  });

  it('adds only the IMDb score to an anime movie', async () => {
    const film = animeInfo({ id: 'mal:199', format: 'Movie' });
    const { lookup, tmdbAdapter, omdbAdapter } = setup({
      settings: keys,
      anime: async () => film,
      tmdbSearch: async () => tmdbMatch({ id: '129', animated: true, japanese: true }),
      tmdbDetails: async () => tmdbDetails({ imdbId: 'tt0245429' }),
    });
    const result = await lookup({ ...request, title: 'Spirited Away' });
    expect(tmdbAdapter.details).toHaveBeenCalledWith(expect.objectContaining({ id: '129' }));
    expect(omdbAdapter.scores).toHaveBeenCalledWith('tt0245429');
    expect(result).toEqual({
      status: 'match',
      info: { ...film, scores: [...film.scores, { source: 'imdb', value: 7.8, votes: 1234567 }] },
    });
  });

  it('keeps an anime movie without IMDb when there is no OMDb key or TMDB details fail', async () => {
    const film = animeInfo({ format: 'Movie' });
    const animeTmdb = async () => tmdbMatch({ animated: true });
    const noOmdb = setup({ settings: { tmdbKey: 'k' }, anime: async () => film, tmdbSearch: animeTmdb });
    expect(await noOmdb.lookup(request)).toEqual({ status: 'match', info: film });
    expect(noOmdb.tmdbAdapter.details).not.toHaveBeenCalled();

    const failing = setup({
      settings: keys,
      anime: async () => film,
      tmdbSearch: animeTmdb,
      tmdbDetails: async () => {
        throw new RequestError('network');
      },
    });
    expect(await failing.lookup(request)).toEqual({ status: 'match', info: film });
    expect(failing.logs).toContain('[sw] omdb skipped tmdb_network');
  });

  it('runs a second anime pass with the TMDB English name', async () => {
    const frieren = animeInfo({
      id: 'mal:52991',
      match: { query: "Frieren: Beyond Journey's End", matchedName: "Frieren: Beyond Journey's End", confidence: 1, source: 'mal' },
    });
    const { lookup, anilist, tmdbAdapter, logs } = setup({
      settings: keys,
      anime: async (title) => (title === "Frieren: Beyond Journey's End" ? frieren : null),
      tmdbSearch: async () => tmdbMatch({ mediaType: 'tv', animated: true, japanese: true, matchedName: 'Frieren' }),
      tmdbDetails: async () => tmdbDetails({ englishName: "Frieren: Beyond Journey's End" }),
    });
    const card = { ...request, title: 'Frieren – Nach dem Ende der Reise', lang: 'de', year: 2023 };
    const result = await lookup(card);
    expect(anilist.search).toHaveBeenNthCalledWith(2, "Frieren: Beyond Journey's End", 2023);
    expect(tmdbAdapter.details).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'match',
      info: { ...frieren, match: { ...frieren.match, query: 'Frieren – Nach dem Ende der Reise' } },
    });
    expect(logs).toContain("[sw] second pass Frieren: Beyond Journey's End");
    expect(logs).toContain('[sw] route anime Frieren – Nach dem Ende der Reise');
  });

  it('falls back to TMDB when the second pass finds nothing, reusing the details', async () => {
    const { lookup, anilist, tmdbAdapter } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch({ animated: true }),
      tmdbDetails: async () => tmdbDetails({ englishName: 'Some English Name' }),
    });
    const result = await lookup(irishman);
    expect(anilist.search).toHaveBeenCalledTimes(2);
    expect(tmdbAdapter.details).toHaveBeenCalledTimes(1);
    expect(result.status === 'match' && result.info.id).toBe('tmdb:movie:398978');
  });

  it('skips the second pass when the TMDB name equals the card title', async () => {
    const { lookup, anilist } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch({ japanese: true }),
      tmdbDetails: async () => tmdbDetails({ englishName: 'the irishman!' }),
    });
    await lookup(irishman);
    expect(anilist.search).toHaveBeenCalledTimes(1);
  });

  it('does not fail the lookup when OMDb is skipped', async () => {
    const { lookup, logs } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch(),
      omdb: async () => ({ status: 'skipped', reason: 'bad_omdb_key' }),
    });
    expect(await lookup(irishman)).toEqual({ status: 'match', info: tmdbDetails().info });
    expect(logs).toContain('[sw] omdb skipped bad_omdb_key');
  });

  it('skips OMDb when TMDB has no IMDb id', async () => {
    const { lookup, omdbAdapter, logs } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch(),
      tmdbDetails: async () => tmdbDetails({ imdbId: undefined }),
    });
    expect((await lookup(irishman)).status).toBe('match');
    expect(omdbAdapter.scores).not.toHaveBeenCalled();
    expect(logs).toContain('[sw] omdb skipped no_imdb_id');
  });

  it('returns no_match when neither side matches', async () => {
    const { lookup, logs } = setup({ settings: keys, anime: async () => null });
    expect(await lookup(irishman)).toEqual({ status: 'no_match' });
    expect(logs).toContain('[sw] route none The Irishman');
  });

  it('routes a confident anime match when TMDB returns 401, without caching it', async () => {
    const { lookup, anilist, tmdbAdapter, omdbAdapter, data, logs } = setup({
      settings: keys,
      tmdbSearch: async () => {
        throw new RequestError('bad_tmdb_key');
      },
    });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(logs).toContain('[sw] tmdb failed bad_tmdb_key, using anime');
    expect(data.size).toBe(0);
    await lookup(request);
    expect(anilist.search).toHaveBeenCalledTimes(2);
    expect(tmdbAdapter.search).toHaveBeenCalledTimes(2);
    expect(tmdbAdapter.details).not.toHaveBeenCalled();
    expect(omdbAdapter.scores).not.toHaveBeenCalled();
  });

  it('routes a confident anime match when the TMDB search times out', async () => {
    const { lookup, logs } = setup({
      settings: keys,
      tmdbSearch: async () => {
        throw new RequestError('network');
      },
    });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(logs).toContain('[sw] tmdb failed network, using anime');
  });

  it('returns bad_tmdb_key when TMDB fails and the anime search has no match', async () => {
    const { lookup, data } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => {
        throw new RequestError('bad_tmdb_key');
      },
    });
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'bad_tmdb_key' });
    expect(data.size).toBe(0);
  });

  it('still answers a live action TMDB match when the anime search fails', async () => {
    const failing = async (): Promise<AnimeInfo | null> => {
      throw new RequestError('network');
    };
    const live = setup({ settings: keys, anime: failing, tmdbSearch: async () => tmdbMatch() });
    expect((await live.lookup(irishman)).status).toBe('match');
    const animated = setup({ settings: keys, anime: failing, tmdbSearch: async () => tmdbMatch({ animated: true }) });
    expect(await animated.lookup(irishman)).toEqual({ status: 'error', reason: 'network' });
  });
});
