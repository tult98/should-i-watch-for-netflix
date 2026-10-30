import { bestMatch } from '../../shared/normalize';
import type { AnimeInfo, Score } from '../../shared/types';
import { RequestError, type FetchFn } from '../requestQueue';
import { present, type AnimeAdapter } from './AnimeAdapter';

export const JIKAN_BASE = 'https://api.jikan.moe/v4';

interface Named {
  name: string | null;
}

export interface JikanAnime {
  mal_id: number;
  title: string | null;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[] | null;
  titles: { type: string | null; title: string | null }[] | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  season: string | null;
  year: number | null;
  aired: { from: string | null; to: string | null } | null;
  genres: Named[] | null;
  themes: Named[] | null;
  demographics: Named[] | null;
  studios: Named[] | null;
  synopsis: string | null;
}

export interface JikanSearchResponse {
  data: JikanAnime[] | null;
}

function names(items: Named[] | null): string[] {
  return (items ?? []).map((n) => n.name).filter(present);
}

function allNames(anime: JikanAnime): string[] {
  const list = [
    anime.title,
    anime.title_english,
    anime.title_japanese,
    ...(anime.title_synonyms ?? []),
    ...(anime.titles ?? []).map((t) => t.title),
  ].filter(present);
  return [...new Set(list)];
}

// Jikan leaves `year` null for most films and OVAs, which have no broadcast season.
function releaseYear(anime: JikanAnime): number | undefined {
  if (present(anime.year)) return anime.year;
  const from = anime.aired?.from;
  const parsed = from ? Number(from.slice(0, 4)) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function seasonLabel(anime: JikanAnime): string | undefined {
  if (!present(anime.season) || !present(anime.year)) return undefined;
  return `${anime.season.charAt(0).toUpperCase()}${anime.season.slice(1)} ${anime.year}`;
}

export function toAnimeInfo(
  anime: JikanAnime,
  match: { query: string; matchedName: string; confidence: number },
): AnimeInfo {
  const scores: Score[] = present(anime.score)
    ? [{ source: 'mal', value: anime.score, ...(present(anime.scored_by) ? { votes: anime.scored_by } : {}) }]
    : [];
  return {
    id: `mal:${anime.mal_id}`,
    kind: 'anime',
    title: anime.title ?? anime.title_english ?? match.matchedName,
    year: releaseYear(anime),
    synopsis: present(anime.synopsis) ? { text: anime.synopsis, lang: 'en' } : undefined,
    genres: [...new Set([...names(anime.genres), ...names(anime.themes)])],
    scores,
    match: { ...match, source: 'mal' },
    format: anime.type ?? 'Unknown',
    episodes: anime.episodes ?? undefined,
    status: anime.status ?? 'Unknown',
    demographic: names(anime.demographics)[0],
    rank: anime.rank ?? undefined,
    popularity: anime.popularity ?? undefined,
    members: anime.members ?? undefined,
    season: seasonLabel(anime),
    aired: { from: anime.aired?.from ?? undefined, to: anime.aired?.to ?? undefined },
    studios: names(anime.studios),
  };
}

export function createJikanAdapter(fetch: FetchFn): AnimeAdapter {
  return {
    async search(title, year) {
      const url = `${JIKAN_BASE}/anime?q=${encodeURIComponent(title)}&limit=5`;
      const response = await fetch(url);
      if (!response.ok) throw new RequestError('network', `Jikan HTTP ${response.status}`);
      const body = (await response.json()) as JikanSearchResponse;
      const candidates = (body.data ?? []).map((anime) => ({
        anime,
        names: allNames(anime),
        year: releaseYear(anime),
        tieBreak: anime.members ?? 0,
      }));
      const best = bestMatch(title, year, candidates);
      if (!best) return null;
      return toAnimeInfo(best.candidate.anime, {
        query: title,
        matchedName: best.matchedName,
        confidence: best.confidence,
      });
    },
  };
}
