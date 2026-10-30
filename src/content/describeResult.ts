import type { LookupResult, Score, ScoreSource } from '../shared/types';

const ORDER: ScoreSource[] = ['mal', 'imdb', 'rt', 'metacritic', 'tmdb'];
const LABEL: Record<ScoreSource, string> = { mal: 'mal', imdb: 'imdb', rt: 'rt', metacritic: 'mc', tmdb: 'tmdb' };

function trim(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)));
}

export function compactCount(n: number): string {
  if (n >= 999_500) return `${trim(n / 1_000_000, 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${trim(n / 1_000, 1)}k`;
  return String(n);
}

function describeScore(score: Score): string {
  const label = LABEL[score.source];
  if (score.source === 'rt') return `${label}=${trim(score.value, 0)}%`;
  if (score.source === 'metacritic') return `${label}=${trim(score.value, 0)}`;
  const value = trim(score.value, score.source === 'mal' ? 2 : 1);
  return `${label}=${value}${score.votes !== undefined ? `(${compactCount(score.votes)})` : ''}`;
}

export function describeScores(scores: Score[]): string {
  return [...scores]
    .sort((a, b) => ORDER.indexOf(a.source) - ORDER.indexOf(b.source))
    .map(describeScore)
    .join(' ');
}

export function describeResult(result: LookupResult): string {
  switch (result.status) {
    case 'match': {
      const { kind, id, scores, match } = result.info;
      const parts = [kind, match.matchedName, `${Math.round(match.confidence * 100)}%`, id, describeScores(scores)];
      return parts.filter((p) => p !== '').join(' ');
    }
    case 'no_match':
      return 'no_match';
    case 'error':
      return `error ${result.reason}`;
  }
}
