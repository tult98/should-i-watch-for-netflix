import type { Score } from '../../shared/types';
import { RequestError, type FetchFn } from '../requestQueue';

export const OMDB_API_BASE = 'https://www.omdbapi.com/';

export interface OmdbResponse {
  Response?: string;
  Error?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Ratings?: { Source?: string; Value?: string }[] | null;
}

export type OmdbSkipReason = 'bad_omdb_key' | 'limit_reached' | 'not_found' | 'rate_limited' | 'network';

export type OmdbResult = { status: 'ok'; scores: Score[] } | { status: 'skipped'; reason: OmdbSkipReason };

export interface OmdbAdapter {
  /** Never throws. A failure only means no extra scores. */
  scores(imdbId: string): Promise<OmdbResult>;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value.replace(/,/g, '').trim());
  return value.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

function rating(body: OmdbResponse, source: string): string | undefined {
  return (body.Ratings ?? []).find((r) => r?.Source === source)?.Value;
}

export function toScores(body: OmdbResponse): Score[] {
  const scores: Score[] = [];
  const imdb = parseNumber(body.imdbRating) ?? parseNumber(rating(body, 'Internet Movie Database')?.split('/')[0]);
  if (imdb !== undefined) {
    const votes = parseNumber(body.imdbVotes);
    scores.push({ source: 'imdb', value: imdb, ...(votes !== undefined ? { votes } : {}) });
  }
  const rt = parseNumber(rating(body, 'Rotten Tomatoes')?.replace('%', ''));
  if (rt !== undefined) scores.push({ source: 'rt', value: rt });
  const mc = parseNumber(body.Metascore) ?? parseNumber(rating(body, 'Metacritic')?.split('/')[0]);
  if (mc !== undefined) scores.push({ source: 'metacritic', value: mc });
  return scores;
}

function skipReason(error: string | undefined): OmdbSkipReason {
  if (error && /invalid api key/i.test(error)) return 'bad_omdb_key';
  if (error && /limit reached/i.test(error)) return 'limit_reached';
  return 'not_found';
}

export function createOmdbAdapter(fetch: FetchFn, key: string): OmdbAdapter {
  return {
    async scores(imdbId) {
      const url = `${OMDB_API_BASE}?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(key)}`;
      let body: OmdbResponse;
      try {
        // OMDb sends the key and limit errors with HTTP 401, so the body decides, not the status.
        body = (await (await fetch(url)).json()) as OmdbResponse;
      } catch (err) {
        const limited = err instanceof RequestError && err.reason === 'rate_limited';
        return { status: 'skipped', reason: limited ? 'rate_limited' : 'network' };
      }
      if (body?.Response !== 'True') return { status: 'skipped', reason: skipReason(body?.Error) };
      return { status: 'ok', scores: toScores(body) };
    },
  };
}
