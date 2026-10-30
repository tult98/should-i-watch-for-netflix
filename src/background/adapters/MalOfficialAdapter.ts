import { bestMatch } from '../../shared/normalize';
import type { AnimeInfo, Score } from '../../shared/types';
import { RequestError, type FetchFn } from '../requestQueue';
import { present, type AnimeAdapter } from './AnimeAdapter';

export const MAL_API_BASE = 'https://api.myanimelist.net/v2';
export const MAL_MIN_QUERY_LENGTH = 3;
export const MAL_FIELDS = [
  'id',
  'title',
  'alternative_titles',
  'start_date',
  'end_date',
  'synopsis',
  'mean',
  'rank',
  'popularity',
  'num_list_users',
  'num_scoring_users',
  'media_type',
  'status',
  'genres',
  'num_episodes',
  'start_season',
  'studios',
].join(',');

interface Named {
  id?: number;
  name?: string | null;
}

export interface MalNode {
  id: number;
  title?: string | null;
  alternative_titles?: { synonyms?: string[] | null; en?: string | null; ja?: string | null } | null;
  start_date?: string | null;
  end_date?: string | null;
  synopsis?: string | null;
  mean?: number | null;
  rank?: number | null;
  popularity?: number | null;
  num_list_users?: number | null;
  num_scoring_users?: number | null;
  media_type?: string | null;
  status?: string | null;
  genres?: Named[] | null;
  num_episodes?: number | null;
  start_season?: { year?: number | null; season?: string | null } | null;
  studios?: Named[] | null;
}

export interface MalSearchResponse {
  data?: { node: MalNode }[] | null;
}

const FORMATS: Record<string, string> = {
  tv: 'TV',
  movie: 'Movie',
  ova: 'OVA',
  ona: 'ONA',
  special: 'Special',
  tv_special: 'TV Special',
  music: 'Music',
};

// Same display strings Jikan returns, so the popover sees one vocabulary.
const STATUSES: Record<string, string> = {
  finished_airing: 'Finished Airing',
  currently_airing: 'Currently Airing',
  not_yet_aired: 'Not yet aired',
};

// MAL's v2 API files demographics under genres; Jikan keeps them separate.
const DEMOGRAPHICS = new Set(['Shounen', 'Shoujo', 'Seinen', 'Josei', 'Kids']);

export function canUseMalOfficial(title: string): boolean {
  return Array.from(title.trim()).length >= MAL_MIN_QUERY_LENGTH;
}

function names(items: Named[] | null | undefined): string[] {
  return (items ?? []).map((n) => n.name).filter(present);
}

function allNames(node: MalNode): string[] {
  const alt = node.alternative_titles;
  const list = [node.title, alt?.en, alt?.ja, ...(alt?.synonyms ?? [])].filter(present);
  return [...new Set(list)];
}

function yearOf(date: string | null | undefined): number | undefined {
  const parsed = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function releaseYear(node: MalNode): number | undefined {
  return node.start_season?.year ?? yearOf(node.start_date);
}

function seasonLabel(node: MalNode): string | undefined {
  const season = node.start_season?.season;
  const year = node.start_season?.year;
  if (!present(season) || !present(year)) return undefined;
  return `${season.charAt(0).toUpperCase()}${season.slice(1)} ${year}`;
}

function display(value: string | null | undefined, table: Record<string, string>): string {
  if (!present(value) || value === 'unknown') return 'Unknown';
  return table[value] ?? value;
}

export function toAnimeInfo(
  node: MalNode,
  match: { query: string; matchedName: string; confidence: number },
): AnimeInfo {
  const scores: Score[] = present(node.mean)
    ? [{ source: 'mal', value: node.mean, ...(present(node.num_scoring_users) ? { votes: node.num_scoring_users } : {}) }]
    : [];
  const genreNames = names(node.genres);
  return {
    id: `mal:${node.id}`,
    kind: 'anime',
    title: node.title ?? node.alternative_titles?.en ?? match.matchedName,
    year: releaseYear(node),
    synopsis: present(node.synopsis) ? { text: node.synopsis, lang: 'en' } : undefined,
    genres: genreNames.filter((g) => !DEMOGRAPHICS.has(g)),
    scores,
    match: { ...match, source: 'mal' },
    format: display(node.media_type, FORMATS),
    episodes: node.num_episodes || undefined,
    status: display(node.status, STATUSES),
    demographic: genreNames.find((g) => DEMOGRAPHICS.has(g)),
    rank: node.rank ?? undefined,
    popularity: node.popularity ?? undefined,
    members: node.num_list_users ?? undefined,
    season: seasonLabel(node),
    aired: { from: node.start_date ?? undefined, to: node.end_date ?? undefined },
    studios: names(node.studios),
  };
}

export function createMalOfficialAdapter(fetch: FetchFn, clientId: string): AnimeAdapter {
  return {
    async search(title, year) {
      const url = `${MAL_API_BASE}/anime?q=${encodeURIComponent(title)}&limit=5&fields=${MAL_FIELDS}`;
      const response = await fetch(url, { headers: { 'X-MAL-CLIENT-ID': clientId } });
      if (response.status === 401 || response.status === 403) {
        throw new RequestError('bad_mal_client_id', `MAL HTTP ${response.status}`);
      }
      if (!response.ok) throw new RequestError('network', `MAL HTTP ${response.status}`);
      const body = (await response.json()) as MalSearchResponse;
      const candidates = (body.data ?? [])
        .map((item) => item?.node)
        .filter(present)
        .map((node) => ({
          node,
          names: allNames(node),
          year: releaseYear(node),
          tieBreak: node.num_list_users ?? 0,
        }));
      const best = bestMatch(title, year, candidates);
      if (!best) return null;
      return toAnimeInfo(best.candidate.node, {
        query: title,
        matchedName: best.matchedName,
        confidence: best.confidence,
      });
    },
  };
}
