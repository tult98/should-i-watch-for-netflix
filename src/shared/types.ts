export type Kind = 'anime' | 'movie' | 'series';
export type ScoreSource = 'mal' | 'imdb' | 'tmdb' | 'rt' | 'metacritic';

export interface Score {
  source: ScoreSource;
  value: number;
  votes?: number;
}

export interface MatchInfo {
  query: string;
  matchedName: string;
  confidence: number;
  source: 'mal' | 'tmdb';
}

export interface BaseInfo {
  id: string;
  kind: Kind;
  title: string;
  year?: number;
  synopsis?: { text: string; lang: 'vi' | 'en' };
  genres: string[];
  scores: Score[];
  match: MatchInfo;
}

export interface AnimeInfo extends BaseInfo {
  kind: 'anime';
  format: string;
  episodes?: number;
  status: string;
  demographic?: string;
  rank?: number;
  popularity?: number;
  members?: number;
  season?: string;
  aired: { from?: string; to?: string };
  studios: string[];
}

export interface MovieInfo extends BaseInfo {
  kind: 'movie';
  runtimeMin?: number;
  directors: string[];
  cast: string[];
  certification?: string;
  releaseDate?: string;
}

export interface SeriesInfo extends BaseInfo {
  kind: 'series';
  seasons?: number;
  episodes?: number;
  status: 'ongoing' | 'ended';
  startYear?: number;
  endYear?: number;
  creators: string[];
  cast: string[];
  certification?: string;
}

export type TitleInfo = AnimeInfo | MovieInfo | SeriesInfo;

export type LookupErrorReason = 'network' | 'rate_limited' | 'bad_mal_client_id' | 'bad_tmdb_key';

export type LookupResult =
  | { status: 'match'; info: TitleInfo }
  | { status: 'no_match' }
  | { status: 'error'; reason: LookupErrorReason };

export type Rating = 'up' | 'down';

export type Verdict = 'highly_recommended' | 'recommended' | 'maybe' | 'skip';

export interface ThresholdSet {
  highly: { score: number; votes: number; rankMax?: number };
  recommended: { score: number; votes: number };
  maybe: { score: number };
  lowVotesBelow: number;
}

export interface Thresholds {
  mal: ThresholdSet;
  imdb: ThresholdSet;
  tmdb: ThresholdSet;
}

export interface AIOpinion {
  summary_vi: string;
  verdict: Verdict;
  reason_vi: string;
}

export type AIErrorReason =
  | 'missing_ai_key'
  | 'bad_ai_key'
  | 'ai_no_balance'
  | 'ai_bad_response'
  | 'network'
  | 'rate_limited';
