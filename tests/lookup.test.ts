import { describe, expect, it, vi } from 'vitest';
import type { AnimeAdapter } from '../src/background/adapters/AnimeAdapter';
import type { OmdbAdapter, OmdbResult } from '../src/background/adapters/OmdbAdapter';
import type { TmdbAdapter, TmdbDetails, TmdbMatch } from '../src/background/adapters/TmdbAdapter';
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

function tmdbMatch(over: Partial<TmdbMatch> = {}): TmdbMatch {
  return {
    tmdbId: 398978,
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

function tmdbDetails(over: Partial<TmdbDetails> = {}): TmdbDetails {
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
  tmdbSearch?: TmdbAdapter['search'];
  tmdbDetails?: TmdbAdapter['details'];
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
  const mal = { search: vi.fn(search) };
  const official = { search: vi.fn(search) };
  const malOfficial = vi.fn((_clientId: string) => official);
  const tmdbAdapter = {
    search: vi.fn(options.tmdbSearch ?? (async () => null)),
    details: vi.fn(options.tmdbDetails ?? (async () => tmdbDetails())),
  };
  const tmdb = vi.fn((_key: string) => tmdbAdapter);
  const omdbAdapter = { scores: vi.fn(options.omdb ?? (async () => omdbOk)) };
  const omdb = vi.fn((_key: string) => omdbAdapter);
  const current = { settings: options.settings ?? {} };
  const logs: string[] = [];
  const lookup = createLookup({
    cache,
    loadSettings: async () => current.settings,
    jikan: mal,
    malOfficial,
    tmdb,
    omdb,
    log: (m) => logs.push(m),
  });
  return { lookup, mal, official, malOfficial, tmdb, tmdbAdapter, omdb, omdbAdapter, current, logs, data };
}

const request = { type: 'lookup' as const, title: 'One Piece', lang: 'en' };
const irishman = { ...request, title: 'The Irishman' };
const keys = { tmdbKey: 'tmdb-key', omdbKey: 'omdb-key' };

describe('lookup without a TMDB key', () => {
  it('fetches on a miss and reads the cache on the second call', async () => {
    const { lookup, mal, tmdb, logs } = setup();
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(mal.search).toHaveBeenCalledTimes(1);
    expect(mal.search).toHaveBeenCalledWith('One Piece', undefined);
    expect(tmdb).not.toHaveBeenCalled();
    expect(logs).toEqual([
      '[sw] fetch jikan One Piece',
      '[sw] route anime One Piece',
      '[sw] cache hit lookup:en|one piece|-',
    ]);
  });

  it('caches a silent no_match and logs the missing key', async () => {
    const { lookup, mal, logs } = setup({ anime: async () => null });
    expect(await lookup(request)).toEqual({ status: 'no_match' });
    await lookup(request);
    expect(mal.search).toHaveBeenCalledTimes(1);
    expect(logs).toContain('[sw] no tmdb key');
  });

  it('maps a rate limit to an uncached error', async () => {
    const { lookup, mal, data } = setup({
      anime: async () => {
        throw new RequestError('rate_limited');
      },
    });
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'rate_limited' });
    expect(data.size).toBe(0);
    await lookup(request);
    expect(mal.search).toHaveBeenCalledTimes(2);
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
    const { lookup, mal } = setup();
    await Promise.all([lookup(request), lookup({ ...request, title: 'ONE PIECE!' })]);
    expect(mal.search).toHaveBeenCalledTimes(1);
  });

  it('uses the official MAL API when a client id is set', async () => {
    const { lookup, mal, official, malOfficial, logs } = setup({ settings: { malClientId: 'abc' } });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(malOfficial).toHaveBeenCalledWith('abc');
    expect(official.search).toHaveBeenCalledWith('One Piece', undefined);
    expect(mal.search).not.toHaveBeenCalled();
    expect(logs).toEqual(['[sw] fetch mal-official One Piece', '[sw] route anime One Piece']);
  });

  it('falls back to Jikan for titles shorter than 3 characters', async () => {
    const { lookup, mal, official, logs } = setup({ settings: { malClientId: 'abc' } });
    await lookup({ ...request, title: '86' });
    expect(official.search).not.toHaveBeenCalled();
    expect(mal.search).toHaveBeenCalledWith('86', undefined);
    expect(logs[0]).toBe('[sw] fetch jikan 86');
  });

  it('retries with the new source after a bad client id is fixed', async () => {
    const { lookup, official, mal, current } = setup({ settings: { malClientId: 'wrong' } });
    official.search.mockRejectedValueOnce(new RequestError('bad_mal_client_id'));
    expect(await lookup(request)).toEqual({ status: 'error', reason: 'bad_mal_client_id' });
    current.settings = {};
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(mal.search).toHaveBeenCalledTimes(1);
  });
});

describe('lookup with TMDB', () => {
  it('starts the anime and TMDB searches in parallel', async () => {
    let releaseAnime: (value: AnimeInfo | null) => void = () => {};
    const { lookup, mal, tmdbAdapter, tmdb } = setup({
      settings: keys,
      anime: () => new Promise((resolve) => (releaseAnime = resolve)),
      tmdbSearch: async () => tmdbMatch(),
    });
    const pending = lookup(irishman);
    await vi.waitFor(() => expect(mal.search).toHaveBeenCalled());
    expect(tmdb).toHaveBeenCalledWith('tmdb-key');
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
      tmdbSearch: async () => tmdbMatch({ tmdbId: 129, animated: true, japanese: true }),
      tmdbDetails: async () => tmdbDetails({ imdbId: 'tt0245429' }),
    });
    const result = await lookup({ ...request, title: 'Spirited Away' });
    expect(tmdbAdapter.details).toHaveBeenCalledWith(expect.objectContaining({ tmdbId: 129 }));
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
    const { lookup, mal, tmdbAdapter, logs } = setup({
      settings: keys,
      anime: async (title) => (title === "Frieren: Beyond Journey's End" ? frieren : null),
      tmdbSearch: async () => tmdbMatch({ mediaType: 'tv', animated: true, japanese: true, matchedName: 'Frieren' }),
      tmdbDetails: async () => tmdbDetails({ englishName: "Frieren: Beyond Journey's End" }),
    });
    const card = { ...request, title: 'Frieren – Nach dem Ende der Reise', lang: 'de', year: 2023 };
    const result = await lookup(card);
    expect(mal.search).toHaveBeenNthCalledWith(2, "Frieren: Beyond Journey's End", 2023);
    expect(tmdbAdapter.details).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'match',
      info: { ...frieren, match: { ...frieren.match, query: 'Frieren – Nach dem Ende der Reise' } },
    });
    expect(logs).toContain("[sw] second pass Frieren: Beyond Journey's End");
    expect(logs).toContain('[sw] route anime Frieren – Nach dem Ende der Reise');
  });

  it('falls back to TMDB when the second pass finds nothing, reusing the details', async () => {
    const { lookup, mal, tmdbAdapter } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch({ animated: true }),
      tmdbDetails: async () => tmdbDetails({ englishName: 'Some English Name' }),
    });
    const result = await lookup(irishman);
    expect(mal.search).toHaveBeenCalledTimes(2);
    expect(tmdbAdapter.details).toHaveBeenCalledTimes(1);
    expect(result.status === 'match' && result.info.id).toBe('tmdb:movie:398978');
  });

  it('skips the second pass when the TMDB name equals the card title', async () => {
    const { lookup, mal } = setup({
      settings: keys,
      anime: async () => null,
      tmdbSearch: async () => tmdbMatch({ japanese: true }),
      tmdbDetails: async () => tmdbDetails({ englishName: 'the irishman!' }),
    });
    await lookup(irishman);
    expect(mal.search).toHaveBeenCalledTimes(1);
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

  it('returns no_match when neither side matches, without the missing key log', async () => {
    const { lookup, logs } = setup({ settings: keys, anime: async () => null });
    expect(await lookup(irishman)).toEqual({ status: 'no_match' });
    expect(logs).toContain('[sw] route none The Irishman');
    expect(logs).not.toContain('[sw] no tmdb key');
  });

  it('routes a confident anime match when TMDB returns 401, without caching it', async () => {
    const { lookup, mal, tmdbAdapter, omdbAdapter, data, logs } = setup({
      settings: keys,
      tmdbSearch: async () => {
        throw new RequestError('bad_tmdb_key');
      },
    });
    expect(await lookup(request)).toEqual({ status: 'match', info: anime });
    expect(logs).toContain('[sw] tmdb failed bad_tmdb_key, using anime');
    expect(data.size).toBe(0);
    await lookup(request);
    expect(mal.search).toHaveBeenCalledTimes(2);
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
