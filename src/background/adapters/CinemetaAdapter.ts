import { bestMatch } from '../../shared/normalize';
import type { MatchInfo, MovieInfo, SeriesInfo } from '../../shared/types';
import { RequestError, type FetchFn } from '../requestQueue';
import { present } from './AnimeAdapter';
import type { FilmAdapter, FilmDetails, FilmMatch, FilmMediaType } from './FilmAdapter';

export const CINEMETA_BASE = 'https://v3-cinemeta.strem.io';
const CAST_LIMIT = 4;

type CinemetaType = 'movie' | 'series';
const CATALOGS: readonly CinemetaType[] = ['movie', 'series'];

export interface CinemetaSearchItem {
  imdb_id?: string | null;
  name?: string | null;
  releaseInfo?: string | null;
}

export interface CinemetaSearchResponse {
  metas?: CinemetaSearchItem[] | null;
}

export interface CinemetaMeta {
  imdb_id?: string | null;
  name?: string | null;
  description?: string | null;
  genres?: string[] | null;
  imdbRating?: string | null;
  releaseInfo?: string | null;
  released?: string | null;
  runtime?: string | null;
  status?: string | null;
  country?: string | null;
  cast?: string[] | null;
  director?: string[] | null;
  writer?: string[] | null;
  videos?: { season?: number | null }[] | null;
}

export interface CinemetaMetaResponse {
  meta?: CinemetaMeta | null;
}

function typeOf(mediaType: FilmMediaType): CinemetaType {
  return mediaType === 'movie' ? 'movie' : 'series';
}

function mediaTypeOf(type: CinemetaType): FilmMediaType {
  return type === 'movie' ? 'movie' : 'tv';
}

/** "2008–2013", "2023-" and "2014" all start with the release year. */
function startYear(releaseInfo: string | null | undefined): number | undefined {
  const parsed = Number(releaseInfo?.match(/^\d{4}/)?.[0]);
  return parsed > 0 ? parsed : undefined;
}

function endYear(releaseInfo: string | null | undefined): number | undefined {
  const parsed = Number(releaseInfo?.match(/^\d{4}\s*[-–]\s*(\d{4})/)?.[1]);
  return parsed > 0 ? parsed : undefined;
}

function list(values: (string | null | undefined)[] | null | undefined): string[] {
  return [...new Set((values ?? []).filter(present))];
}

function runtimeMinutes(runtime: string | null | undefined): number | undefined {
  const parsed = Number(runtime?.match(/\d+/)?.[0]);
  return parsed > 0 ? parsed : undefined;
}

// Cinemeta publishes the IMDb rating without its vote count.
function scoresOf(meta: CinemetaMeta): MovieInfo['scores'] {
  const value = Number(meta.imdbRating);
  return present(meta.imdbRating) && value > 0 ? [{ source: 'imdb', value }] : [];
}

function seasonsOf(meta: CinemetaMeta): { seasons?: number; episodes?: number } {
  const regular = (meta.videos ?? []).filter((v) => (v.season ?? 0) > 0);
  if (regular.length === 0) return {};
  return { seasons: Math.max(...regular.map((v) => v.season ?? 0)), episodes: regular.length };
}

function base(meta: CinemetaMeta, match: FilmMatch) {
  const matchInfo: MatchInfo = {
    query: match.query,
    matchedName: match.matchedName,
    confidence: match.confidence,
    source: 'cinemeta',
  };
  const description = meta.description?.trim();
  return {
    title: meta.name || match.matchedName,
    year: startYear(meta.releaseInfo) ?? match.year,
    synopsis: description ? { text: description, lang: 'en' as const } : undefined,
    genres: list(meta.genres),
    scores: scoresOf(meta),
    match: matchInfo,
    cast: list(meta.cast).slice(0, CAST_LIMIT),
  };
}

export function toFilmDetails(meta: CinemetaMeta, match: FilmMatch): FilmDetails {
  const imdbId = meta.imdb_id || undefined;
  if (match.mediaType === 'movie') {
    const info: MovieInfo = {
      id: `imdb:${imdbId ?? match.id}`,
      kind: 'movie',
      ...base(meta, match),
      runtimeMin: runtimeMinutes(meta.runtime),
      directors: list(meta.director),
      releaseDate: meta.released?.slice(0, 10) || undefined,
    };
    return { info, imdbId, englishName: meta.name || undefined };
  }
  const ended = meta.status === 'Ended';
  const start = startYear(meta.releaseInfo);
  const info: SeriesInfo = {
    id: `imdb:${imdbId ?? match.id}`,
    kind: 'series',
    ...base(meta, match),
    ...seasonsOf(meta),
    status: ended ? 'ended' : 'ongoing',
    startYear: start,
    endYear: ended ? (endYear(meta.releaseInfo) ?? start) : undefined,
    // IMDb files a series' creators under writers.
    creators: list(meta.writer),
  };
  return { info, imdbId, englishName: meta.name || undefined };
}

export function createCinemetaAdapter(fetch: FetchFn): FilmAdapter {
  const metas = new Map<string, Promise<CinemetaMeta>>();

  async function getJson<T>(path: string): Promise<T> {
    const response = await fetch(`${CINEMETA_BASE}${path}`);
    if (!response.ok) throw new RequestError('network', `Cinemeta HTTP ${response.status}`);
    return (await response.json()) as T;
  }

  // One lookup asks for the same meta in search and again in details, so the second read is free.
  function meta(type: CinemetaType, id: string): Promise<CinemetaMeta> {
    const key = `${type}/${id}`;
    let pending = metas.get(key);
    if (!pending) {
      pending = getJson<CinemetaMetaResponse>(`/meta/${type}/${encodeURIComponent(id)}.json`).then((body) => {
        if (!body.meta?.name) throw new RequestError('network', `Cinemeta has no meta for ${key}`);
        return body.meta;
      });
      pending.catch(() => metas.delete(key));
      metas.set(key, pending);
    }
    return pending;
  }

  async function searchCatalog(type: CinemetaType, title: string) {
    const body = await getJson<CinemetaSearchResponse>(`/catalog/${type}/top/search=${encodeURIComponent(title)}.json`);
    return (body.metas ?? []).flatMap((item, index) =>
      item?.imdb_id && item.name
        ? [{ id: item.imdb_id, type, names: [item.name], year: startYear(item.releaseInfo), tieBreak: -index }]
        : [],
    );
  }

  return {
    // The year stays out of the query because Cinemeta returns nothing for it, so it only ranks the results.
    async search(title, year) {
      const candidates = (await Promise.all(CATALOGS.map((type) => searchCatalog(type, title)))).flat();
      const best = bestMatch(title, year, candidates);
      if (!best) return null;
      const { id, type } = best.candidate;
      const found = await meta(type, id);
      return {
        id,
        mediaType: mediaTypeOf(type),
        query: title,
        matchedName: best.matchedName,
        confidence: best.confidence,
        year: best.candidate.year,
        animated: (found.genres ?? []).includes('Animation'),
        japanese: (found.country ?? '').split(',').some((c) => c.trim() === 'Japan'),
      };
    },
    async details(match) {
      return toFilmDetails(await meta(typeOf(match.mediaType), match.id), match);
    },
  };
}
