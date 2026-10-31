import { describe, expect, it } from 'vitest';
import { createTmdbAdapter } from '../src/background/adapters/TmdbAdapter';
import { route, type TmdbCandidate } from '../src/background/routing';
import { bestMatch } from '../src/shared/normalize';
import onePieceSearch from './fixtures/tmdb-search-one-piece.json';

const mal = { confidence: 0.95 };
const weakMal = { confidence: 0.84 };
const liveAction: TmdbCandidate = { confidence: 0.95, animated: false, japanese: false };
const animated: TmdbCandidate = { confidence: 0.95, animated: true, japanese: false };
const japanese: TmdbCandidate = { confidence: 0.95, animated: false, japanese: true };
const weakTmdb: TmdbCandidate = { confidence: 0.5, animated: false, japanese: false };

describe('route', () => {
  it('confident MAL and no TMDB match goes to anime', () => {
    expect(route(mal, null)).toBe('anime');
    expect(route(mal, weakTmdb)).toBe('anime');
  });

  it('confident MAL and an animated TMDB match goes to anime', () => {
    expect(route(mal, animated)).toBe('anime');
    expect(route(mal, { ...animated, japanese: true })).toBe('anime');
  });

  it('confident MAL and a live action TMDB match goes to TMDB, Japanese or not', () => {
    expect(route(mal, liveAction)).toBe('tmdb');
    expect(route(mal, japanese)).toBe('tmdb');
  });

  it('weak or missing MAL and a confident TMDB match goes to TMDB', () => {
    expect(route(null, liveAction)).toBe('tmdb');
    expect(route(weakMal, liveAction)).toBe('tmdb');
    expect(route(null, animated)).toBe('tmdb');
  });

  it('weak or missing on both sides is none', () => {
    expect(route(null, null)).toBe('none');
    expect(route(weakMal, weakTmdb)).toBe('none');
    expect(route(weakMal, null)).toBe('none');
  });

  it('treats the threshold itself as confident', () => {
    expect(route({ confidence: 0.85 }, null)).toBe('anime');
    expect(route(null, { ...liveAction, confidence: 0.85 })).toBe('tmdb');
  });
});

describe('route for One Piece', () => {
  const malOnePiece = { names: ['One Piece', 'ONE PIECE'], year: 1999, tieBreak: 0 };

  async function tmdbFor(year?: number) {
    const fetch = async () => new Response(JSON.stringify(onePieceSearch));
    return createTmdbAdapter(fetch, 'k').search('One Piece', year, 'en');
  }

  it('card year 1999 picks the anime', async () => {
    const anime = bestMatch('One Piece', 1999, [malOnePiece]);
    expect(route(anime, await tmdbFor(1999))).toBe('anime');
  });

  it('card year 2023 picks the live action', async () => {
    const anime = bestMatch('One Piece', 2023, [malOnePiece]);
    expect(anime).toBeNull();
    expect(route(anime, await tmdbFor(2023))).toBe('tmdb');
  });

  it('without a year a live action TMDB best match wins over a MAL match', () => {
    const anime = bestMatch('One Piece', undefined, [malOnePiece]);
    expect(route(anime, liveAction)).toBe('tmdb');
  });
});
