import { bestMatch } from '../../shared/normalize';
import type { AnimeInfo } from '../../shared/types';
import { RequestError, type FetchFn } from '../requestQueue';
import { present, type AnimeAdapter } from './AnimeAdapter';

export const ANILIST_URL = 'https://graphql.anilist.co';

const SEARCH_QUERY = `query ($q: String) {
  Page(perPage: 5) {
    media(search: $q, type: ANIME) {
      id idMal title { romaji english native } synonyms seasonYear format episodes status
      averageScore popularity genres studios { nodes { name } } description
      startDate { year month day } endDate { year month day } season
    }
  }
}`;

interface FuzzyDate {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export interface AniListMedia {
  id: number;
  idMal?: number | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  synonyms?: string[] | null;
  seasonYear?: number | null;
  format?: string | null;
  episodes?: number | null;
  status?: string | null;
  averageScore?: number | null;
  popularity?: number | null;
  genres?: string[] | null;
  studios?: { nodes?: { name?: string | null }[] | null } | null;
  description?: string | null;
  startDate?: FuzzyDate | null;
  endDate?: FuzzyDate | null;
  season?: string | null;
}

export interface AniListResponse {
  data?: { Page?: { media?: AniListMedia[] | null } | null } | null;
  errors?: { message?: string | null }[] | null;
}

// MAL spells these the way the popover's labels expect.
const FORMATS: Record<string, string> = { MOVIE: 'Movie', TV_SHORT: 'TV', SPECIAL: 'Special', MUSIC: 'Music' };
const STATUSES: Record<string, string> = {
  FINISHED: 'Finished Airing',
  RELEASING: 'Currently Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'On Hiatus',
};
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#039': "'" };

function allNames(media: AniListMedia): string[] {
  const { romaji, english, native } = media.title ?? {};
  return [...new Set([romaji, english, native, ...(media.synonyms ?? [])].filter(present))];
}

function releaseYear(media: AniListMedia): number | undefined {
  return media.startDate?.year ?? media.seasonYear ?? undefined;
}

function isoDate(date: FuzzyDate | null | undefined): string | undefined {
  if (!date?.year) return undefined;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (!date.month) return String(date.year);
  return date.day ? `${date.year}-${pad(date.month)}-${pad(date.day)}` : `${date.year}-${pad(date.month)}`;
}

function seasonLabel(media: AniListMedia): string | undefined {
  if (!present(media.season) || !present(media.seasonYear)) return undefined;
  return `${media.season.charAt(0)}${media.season.slice(1).toLowerCase()} ${media.seasonYear}`;
}

// AniList descriptions are HTML.
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (whole, name: string) => ENTITIES[name] ?? whole)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function toAnimeInfo(
  media: AniListMedia,
  match: { query: string; matchedName: string; confidence: number },
): AnimeInfo {
  const description = media.description ? plainText(media.description) : '';
  return {
    id: media.idMal ? `mal:${media.idMal}` : `anilist:${media.id}`,
    kind: 'anime',
    title: media.title?.english ?? media.title?.romaji ?? match.matchedName,
    year: releaseYear(media),
    synopsis: description ? { text: description, lang: 'en' } : undefined,
    genres: (media.genres ?? []).filter(present),
    // averageScore is 0 to 100. AniList has no count of scorers, so no votes are claimed.
    scores: present(media.averageScore) ? [{ source: 'anilist', value: media.averageScore / 10 }] : [],
    match: { ...match, source: 'anilist' },
    format: (media.format && (FORMATS[media.format] ?? media.format)) || 'Unknown',
    episodes: media.episodes ?? undefined,
    status: (media.status && STATUSES[media.status]) || 'Unknown',
    // AniList "popularity" counts the users who list the title, which is MAL's members, not a rank.
    members: media.popularity ?? undefined,
    season: seasonLabel(media),
    aired: { from: isoDate(media.startDate), to: isoDate(media.endDate) },
    studios: (media.studios?.nodes ?? []).map((s) => s.name).filter(present),
  };
}

export function createAniListAdapter(fetch: FetchFn): AnimeAdapter {
  return {
    async search(title, year) {
      const response = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: SEARCH_QUERY, variables: { q: title } }),
      });
      if (!response.ok) throw new RequestError('network', `AniList HTTP ${response.status}`);
      const body = (await response.json()) as AniListResponse;
      if (body.errors?.length) throw new RequestError('network', `AniList ${body.errors[0]?.message ?? 'error'}`);
      const candidates = (body.data?.Page?.media ?? []).map((media) => ({
        media,
        names: allNames(media),
        year: releaseYear(media),
        tieBreak: media.popularity ?? 0,
      }));
      const best = bestMatch(title, year, candidates);
      if (!best) return null;
      return toAnimeInfo(best.candidate.media, {
        query: title,
        matchedName: best.matchedName,
        confidence: best.confidence,
      });
    },
  };
}
