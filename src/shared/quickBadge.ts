import type { Score, ThresholdSet, Thresholds, TitleInfo, Verdict } from './types';

export type BadgeSource = 'mal' | 'imdb' | 'tmdb';

export type QuickBadge =
  | { verdict: Verdict; source: BadgeSource; score: Score; lowVotes: boolean }
  | { verdict: null; source: null; score: null; lowVotes: false };

const NO_BADGE: QuickBadge = { verdict: null, source: null, score: null, lowVotes: false };

function findScore(info: TitleInfo, source: BadgeSource): Score | undefined {
  return info.scores.find((s) => s.source === source);
}

function pickSource(info: TitleInfo): { source: BadgeSource; score: Score } | null {
  const order: BadgeSource[] = info.kind === 'anime' ? ['mal'] : ['imdb', 'tmdb'];
  for (const source of order) {
    const score = findScore(info, source);
    if (score) return { source, score };
  }
  return null;
}

// An unranked anime cannot pass a rankMax rule, the same way missing votes count as zero.
function verdictFor(score: Score, rank: number | undefined, t: ThresholdSet): Verdict {
  const votes = score.votes ?? 0;
  const { highly, recommended, maybe } = t;
  const rankOk = highly.rankMax === undefined || (rank !== undefined && rank <= highly.rankMax);
  if (score.value >= highly.score && votes >= highly.votes && rankOk) return 'highly_recommended';
  if (score.value >= recommended.score && votes >= recommended.votes) return 'recommended';
  if (score.value >= maybe.score) return 'maybe';
  return 'skip';
}

export function quickVerdict(info: TitleInfo, thresholds: Thresholds): QuickBadge {
  const picked = pickSource(info);
  if (!picked) return NO_BADGE;
  const { source, score } = picked;
  const set = thresholds[source];
  const rank = info.kind === 'anime' ? info.rank : undefined;
  return {
    verdict: verdictFor(score, rank, set),
    source,
    score,
    lowVotes: (score.votes ?? 0) < set.lowVotesBelow,
  };
}
