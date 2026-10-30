import { MATCH_THRESHOLD } from '../shared/normalize';

export type Route = 'anime' | 'tmdb' | 'none';

export interface AnimeCandidate {
  confidence: number;
}

export interface TmdbCandidate {
  confidence: number;
  animated: boolean;
  japanese: boolean;
}

function confident<T extends { confidence: number }>(match: T | null): match is T {
  return match !== null && match.confidence >= MATCH_THRESHOLD;
}

/**
 * The card year is already inside both confidences, so "One Piece" with year 1999 loses the
 * 2023 live action on TMDB and with year 2023 loses the anime on MAL. Without a year both
 * match, and a live action TMDB result wins.
 */
export function route(mal: AnimeCandidate | null, tmdb: TmdbCandidate | null): Route {
  const tmdbOk = confident(tmdb);
  if (confident(mal)) {
    if (!tmdbOk || tmdb.animated || tmdb.japanese) return 'anime';
    return 'tmdb';
  }
  return tmdbOk ? 'tmdb' : 'none';
}
