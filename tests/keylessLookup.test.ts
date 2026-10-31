import { describe, expect, it, vi } from 'vitest';
import { createAniListAdapter } from '../src/background/adapters/AniListAdapter';
import { createCinemetaAdapter } from '../src/background/adapters/CinemetaAdapter';
import type { LookupCache } from '../src/background/cache';
import { createLookup } from '../src/background/lookup';
import type { FetchFn } from '../src/background/requestQueue';
import { quickVerdict } from '../src/shared/quickBadge';
import { DEFAULT_THRESHOLDS } from '../src/shared/settings';
import type { LookupResult } from '../src/shared/types';
import anilistBreakingBad from './fixtures/anilist-breaking-bad.json';
import anilistFrieren from './fixtures/anilist-frieren.json';
import anilistInterstellar from './fixtures/anilist-interstellar.json';
import anilistOnePiece from './fixtures/anilist-one-piece.json';
import frierenMeta from './fixtures/cinemeta-meta-frieren.json';
import breakingBadMeta from './fixtures/cinemeta-meta-breaking-bad.json';
import interstellarMeta from './fixtures/cinemeta-meta-interstellar.json';
import onePieceAnimeMeta from './fixtures/cinemeta-meta-one-piece-anime.json';
import onePieceLiveMeta from './fixtures/cinemeta-meta-one-piece-live.json';
import interstellarSearch from './fixtures/cinemeta-search-movie-interstellar.json';
import onePieceMovieSearch from './fixtures/cinemeta-search-movie-one-piece.json';
import emptySearch from './fixtures/cinemeta-search-series-empty.json';
import breakingBadSearch from './fixtures/cinemeta-search-series-breaking-bad.json';
import frierenSearch from './fixtures/cinemeta-search-series-frieren.json';
import onePieceSeriesSearch from './fixtures/cinemeta-search-series-one-piece.json';

const noMetas = { metas: [] };
const noMedia = { data: { Page: { media: [] } } };

const CINEMETA: Record<string, unknown> = {
  '/catalog/movie/top/search=Interstellar.json': interstellarSearch,
  '/catalog/series/top/search=Interstellar.json': emptySearch,
  '/meta/movie/tt0816692.json': interstellarMeta,
  '/catalog/movie/top/search=Breaking%20Bad.json': noMetas,
  '/catalog/series/top/search=Breaking%20Bad.json': breakingBadSearch,
  '/meta/series/tt0903747.json': breakingBadMeta,
  '/catalog/movie/top/search=One%20Piece.json': onePieceMovieSearch,
  '/catalog/series/top/search=One%20Piece.json': onePieceSeriesSearch,
  '/meta/series/tt0388629.json': onePieceAnimeMeta,
  '/meta/series/tt11737520.json': onePieceLiveMeta,
  '/catalog/movie/top/search=Frieren%3A%20Beyond%20Journey\'s%20End.json': noMetas,
  '/catalog/series/top/search=Frieren%3A%20Beyond%20Journey\'s%20End.json': frierenSearch,
  '/meta/series/tt22248376.json': frierenMeta,
};

const ANILIST: Record<string, unknown> = {
  Interstellar: anilistInterstellar,
  'Breaking Bad': anilistBreakingBad,
  'One Piece': anilistOnePiece,
  "Frieren: Beyond Journey's End": anilistFrieren,
};

// Real adapters over recorded responses, so the routing runs on what the services actually return.
function setup() {
  const fetch = vi.fn<FetchFn>(async (url, init) => {
    if (url === 'https://graphql.anilist.co') {
      const { q } = JSON.parse(String(init?.body)).variables as { q: string };
      return new Response(JSON.stringify(ANILIST[q] ?? noMedia));
    }
    const path = url.replace('https://v3-cinemeta.strem.io', '');
    if (path.startsWith('/catalog/')) return new Response(JSON.stringify(CINEMETA[path] ?? noMetas));
    if (!(path in CINEMETA)) throw new Error(`unexpected request ${url}`);
    return new Response(JSON.stringify(CINEMETA[path]));
  });
  const cache: LookupCache = { get: async () => undefined, set: async () => {} };
  const lookup = createLookup({
    cache,
    loadSettings: async () => ({}),
    anilist: createAniListAdapter(fetch),
    malOfficial: () => {
      throw new Error('no client id is set');
    },
    tmdb: () => {
      throw new Error('no TMDB key is set');
    },
    cinemeta: () => createCinemetaAdapter(fetch),
    omdb: () => {
      throw new Error('no OMDb key is set');
    },
  });
  return { lookup, fetch };
}

function info(result: LookupResult) {
  if (result.status !== 'match') throw new Error(`expected a match, got ${result.status}`);
  return result.info;
}

const card = (title: string, year?: number) => ({ type: 'lookup' as const, title, year, lang: 'en' });

describe('lookup with no keys, on recorded responses', () => {
  it('answers a film from Cinemeta with an IMDb badge', async () => {
    const found = info(await setup().lookup(card('Interstellar', 2014)));
    expect(found).toMatchObject({ kind: 'movie', id: 'imdb:tt0816692', scores: [{ source: 'imdb', value: 8.7 }] });
    expect(quickVerdict(found, DEFAULT_THRESHOLDS)).toMatchObject({ verdict: 'highly_recommended', lowVotes: false });
  });

  it('answers a series from Cinemeta', async () => {
    const found = info(await setup().lookup(card('Breaking Bad', 2008)));
    expect(found).toMatchObject({ kind: 'series', seasons: 5, episodes: 62, status: 'ended' });
    expect(quickVerdict(found, DEFAULT_THRESHOLDS).source).toBe('imdb');
  });

  it('answers an anime from AniList with an AniList badge', async () => {
    const found = info(await setup().lookup(card("Frieren: Beyond Journey's End", 2023)));
    expect(found).toMatchObject({ kind: 'anime', id: 'mal:52991', scores: [{ source: 'anilist', value: 9.1 }] });
    expect(quickVerdict(found, DEFAULT_THRESHOLDS)).toMatchObject({
      verdict: 'highly_recommended',
      source: 'anilist',
      lowVotes: false,
    });
  });

  it('routes One Piece to the anime for 1999 and to the live action for 2023', async () => {
    expect(info(await setup().lookup(card('One Piece', 1999)))).toMatchObject({
      kind: 'anime',
      id: 'mal:21',
      match: { source: 'anilist' },
    });
    expect(info(await setup().lookup(card('One Piece', 2023)))).toMatchObject({
      kind: 'series',
      id: 'imdb:tt11737520',
      scores: [{ source: 'imdb', value: 8.3 }],
      match: { source: 'cinemeta' },
    });
  });

  it('keeps the anime for One Piece with no year, since the anime is listed first', async () => {
    expect(info(await setup().lookup(card('One Piece'))).kind).toBe('anime');
  });

  it('does not match an unrelated title', async () => {
    expect(await setup().lookup(card('Zzz Unknown Title'))).toEqual({ status: 'no_match' });
  });
});
