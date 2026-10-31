import type { MovieInfo, SeriesInfo } from '../../shared/types';

export type FilmMediaType = 'movie' | 'tv';

export interface FilmMatch {
  /** The source's own id: a TMDB id or an IMDb id. */
  id: string;
  mediaType: FilmMediaType;
  query: string;
  matchedName: string;
  confidence: number;
  year?: number;
  animated: boolean;
  japanese: boolean;
}

export interface FilmDetails {
  info: MovieInfo | SeriesInfo;
  imdbId?: string;
  /** English title from translations, else the original title. Feeds the second anime search. */
  englishName?: string;
}

export interface FilmAdapter {
  search(title: string, year: number | undefined, lang: string): Promise<FilmMatch | null>;
  details(match: FilmMatch): Promise<FilmDetails>;
}
