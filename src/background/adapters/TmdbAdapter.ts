import { locale, type Locale } from '../../shared/i18n';
import { bestMatch } from '../../shared/normalize';
import type { MatchInfo, MovieInfo, SeriesInfo } from '../../shared/types';
import { RequestError, type FetchFn } from '../requestQueue';
import { present } from './AnimeAdapter';
import type { FilmAdapter, FilmDetails, FilmMatch, FilmMediaType } from './FilmAdapter';

export const TMDB_API_BASE = 'https://api.themoviedb.org/3';
export const TMDB_ANIMATION_GENRE = 16;
const DETAILS_LANGUAGE: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US' };
const FALLBACK_LANGUAGE = 'en-US';
const CAST_LIMIT = 4;

export interface TmdbSearchItem {
  id: number;
  media_type?: string | null;
  title?: string | null;
  original_title?: string | null;
  name?: string | null;
  original_name?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genre_ids?: number[] | null;
  origin_country?: string[] | null;
  original_language?: string | null;
  popularity?: number | null;
  vote_count?: number | null;
}

export interface TmdbSearchResponse {
  results?: TmdbSearchItem[] | null;
}

interface Named {
  name?: string | null;
}

interface Person extends Named {
  order?: number | null;
  job?: string | null;
}

interface Translation {
  iso_639_1?: string | null;
  iso_3166_1?: string | null;
  data?: { title?: string | null; name?: string | null; overview?: string | null } | null;
}

export interface TmdbDetailsResponse {
  id: number;
  title?: string | null;
  original_title?: string | null;
  name?: string | null;
  original_name?: string | null;
  overview?: string | null;
  genres?: Named[] | null;
  vote_average?: number | null;
  vote_count?: number | null;
  release_date?: string | null;
  runtime?: number | null;
  first_air_date?: string | null;
  last_air_date?: string | null;
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  status?: string | null;
  created_by?: Named[] | null;
  credits?: { cast?: Person[] | null; crew?: Person[] | null } | null;
  aggregate_credits?: { cast?: Person[] | null } | null;
  release_dates?: {
    results?: { iso_3166_1?: string | null; release_dates?: { certification?: string | null }[] | null }[] | null;
  } | null;
  content_ratings?: { results?: { iso_3166_1?: string | null; rating?: string | null }[] | null } | null;
  external_ids?: { imdb_id?: string | null } | null;
  translations?: { translations?: Translation[] | null } | null;
}

function yearOf(date: string | null | undefined): number | undefined {
  const parsed = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function unique(list: (string | null | undefined)[]): string[] {
  return [...new Set(list.filter(present))];
}

function mediaTypeOf(item: TmdbSearchItem): FilmMediaType | null {
  return item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : null;
}

function isEnglish(lang: string): boolean {
  return lang.toLowerCase().split(/[-_]/)[0] === 'en';
}

function topCast(people: Person[] | null | undefined): string[] {
  return [...(people ?? [])]
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
    .map((p) => p.name)
    .filter(present)
    .slice(0, CAST_LIMIT);
}

function names(items: Named[] | null | undefined): string[] {
  return unique((items ?? []).map((n) => n.name));
}

function englishTranslation(details: TmdbDetailsResponse): Translation['data'] | undefined {
  const english = (details.translations?.translations ?? []).filter((t) => t.iso_639_1 === 'en');
  return (english.find((t) => t.iso_3166_1 === 'US') ?? english[0])?.data ?? undefined;
}

function synopsisOf(details: TmdbDetailsResponse, loc: Locale): MovieInfo['synopsis'] {
  const own = details.overview?.trim();
  if (own) return { text: own, lang: loc };
  const en = englishTranslation(details)?.overview?.trim();
  return en ? { text: en, lang: 'en' } : undefined;
}

function scoresOf(details: TmdbDetailsResponse): MovieInfo['scores'] {
  if (!present(details.vote_average) || !details.vote_count) return [];
  return [{ source: 'tmdb', value: details.vote_average, votes: details.vote_count }];
}

function pickByCountry<T extends { iso_3166_1?: string | null }>(
  results: T[] | null | undefined,
  value: (item: T) => string | undefined,
): string | undefined {
  for (const country of ['VN', 'US']) {
    for (const item of results ?? []) {
      if (item.iso_3166_1 !== country) continue;
      const found = value(item);
      if (found) return found;
    }
  }
  return undefined;
}

function movieCertification(details: TmdbDetailsResponse): string | undefined {
  return pickByCountry(details.release_dates?.results, (r) =>
    (r.release_dates ?? []).map((d) => d.certification?.trim()).find(present),
  );
}

function tvCertification(details: TmdbDetailsResponse): string | undefined {
  return pickByCountry(details.content_ratings?.results, (r) => r.rating?.trim() || undefined);
}

function toMovieInfo(details: TmdbDetailsResponse, match: MatchInfo, loc: Locale): MovieInfo {
  return {
    id: `tmdb:movie:${details.id}`,
    kind: 'movie',
    title: details.title || details.original_title || match.matchedName,
    year: yearOf(details.release_date),
    synopsis: synopsisOf(details, loc),
    genres: names(details.genres),
    scores: scoresOf(details),
    match,
    runtimeMin: details.runtime || undefined,
    directors: unique((details.credits?.crew ?? []).filter((p) => p.job === 'Director').map((p) => p.name)),
    cast: topCast(details.credits?.cast),
    certification: movieCertification(details),
    releaseDate: details.release_date || undefined,
  };
}

const ENDED_STATUSES = new Set(['Ended', 'Canceled']);

function toSeriesInfo(details: TmdbDetailsResponse, match: MatchInfo, loc: Locale): SeriesInfo {
  const status = ENDED_STATUSES.has(details.status ?? '') ? 'ended' : 'ongoing';
  const startYear = yearOf(details.first_air_date);
  return {
    id: `tmdb:tv:${details.id}`,
    kind: 'series',
    title: details.name || details.original_name || match.matchedName,
    year: startYear,
    synopsis: synopsisOf(details, loc),
    genres: names(details.genres),
    scores: scoresOf(details),
    match,
    seasons: details.number_of_seasons || undefined,
    episodes: details.number_of_episodes || undefined,
    status,
    startYear,
    // last_air_date of a running show is its latest episode, not an end.
    endYear: status === 'ended' ? yearOf(details.last_air_date) : undefined,
    creators: names(details.created_by),
    cast: topCast(details.aggregate_credits?.cast),
    certification: tvCertification(details),
  };
}

export function toTmdbDetails(details: TmdbDetailsResponse, match: FilmMatch, loc: Locale = locale): FilmDetails {
  const matchInfo: MatchInfo = {
    query: match.query,
    matchedName: match.matchedName,
    confidence: match.confidence,
    source: 'tmdb',
  };
  const info = match.mediaType === 'movie' ? toMovieInfo(details, matchInfo, loc) : toSeriesInfo(details, matchInfo, loc);
  const en = englishTranslation(details);
  const englishName =
    en?.title?.trim() || en?.name?.trim() || details.original_title || details.original_name || undefined;
  return { info, imdbId: details.external_ids?.imdb_id || undefined, englishName };
}

// A v4 read access token is a JWT, and every JWT starts with the base64 of '{"'.
export function isReadAccessToken(key: string): boolean {
  return key.startsWith('eyJ');
}

export function createTmdbAdapter(fetch: FetchFn, key: string, loc: Locale = locale): FilmAdapter {
  const bearer = isReadAccessToken(key);

  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const query = new URLSearchParams(params);
    if (!bearer) query.set('api_key', key);
    const url = `${TMDB_API_BASE}${path}?${query.toString()}`;
    const response = await (bearer ? fetch(url, { headers: { Authorization: `Bearer ${key}` } }) : fetch(url));
    if (response.status === 401) throw new RequestError('bad_tmdb_key', `TMDB HTTP 401`);
    if (!response.ok) throw new RequestError('network', `TMDB HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  async function searchOnce(title: string, year: number | undefined, language: string): Promise<FilmMatch | null> {
    const body = await get<TmdbSearchResponse>('/search/multi', {
      query: title,
      language,
      include_adult: 'false',
    });
    const candidates = (body.results ?? []).flatMap((item) => {
      const mediaType = item ? mediaTypeOf(item) : null;
      if (!mediaType) return [];
      return [
        {
          item,
          mediaType,
          names: unique([item.title, item.name, item.original_title, item.original_name]),
          year: yearOf(item.release_date ?? item.first_air_date),
          tieBreak: item.vote_count ?? 0,
        },
      ];
    });
    const best = bestMatch(title, year, candidates);
    if (!best) return null;
    const { item, mediaType } = best.candidate;
    return {
      id: String(item.id),
      mediaType,
      query: title,
      matchedName: best.matchedName,
      confidence: best.confidence,
      year: best.candidate.year,
      animated: (item.genre_ids ?? []).includes(TMDB_ANIMATION_GENRE),
      japanese: (item.origin_country ?? []).includes('JP') || item.original_language === 'ja',
    };
  }

  return {
    async search(title, year, lang) {
      const found = await searchOnce(title, year, lang);
      if (found || isEnglish(lang)) return found;
      return searchOnce(title, year, FALLBACK_LANGUAGE);
    },
    async details(match) {
      const append =
        match.mediaType === 'movie'
          ? 'credits,release_dates,external_ids,translations'
          : 'aggregate_credits,content_ratings,external_ids,translations';
      const body = await get<TmdbDetailsResponse>(`/${match.mediaType}/${match.id}`, {
        language: DETAILS_LANGUAGE[loc],
        append_to_response: append,
      });
      return toTmdbDetails(body, match, loc);
    },
  };
}
