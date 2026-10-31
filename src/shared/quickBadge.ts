import type { Score, ThresholdSet, Thresholds, TitleInfo, Verdict } from './types';

export type BadgeSource = 'mal' | 'anilist' | 'imdb' | 'tmdb';

export type QuickBadge =
  | { verdict: Verdict; source: BadgeSource; score: Score; lowVotes: boolean }
  | { verdict: null; source: null; score: null; lowVotes: false };

// AniList shares the MAL anime thresholds, so the settings page needs no fourth set.
const THRESHOLD_SET: Record<BadgeSource, keyof Thresholds> = { mal: 'mal', anilist: 'mal', imdb: 'imdb', tmdb: 'tmdb' };

// These sources publish a score without a vote count, so an unknown count is not a small one.
const VOTES_OPTIONAL: ReadonlySet<BadgeSource> = new Set(['imdb', 'anilist']);

const NO_BADGE: QuickBadge = { verdict: null, source: null, score: null, lowVotes: false };

function findScore(info: TitleInfo, source: BadgeSource): Score | undefined {
  return info.scores.find((s) => s.source === source);
}

function pickSource(info: TitleInfo): { source: BadgeSource; score: Score } | null {
  const order: BadgeSource[] = info.kind === 'anime' ? ['mal', 'anilist'] : ['imdb', 'tmdb'];
  for (const source of order) {
    const score = findScore(info, source);
    if (score) return { source, score };
  }
  return null;
}

function hasVotes(source: BadgeSource, score: Score): boolean {
  return score.votes !== undefined || !VOTES_OPTIONAL.has(source);
}

// An unranked anime cannot pass a rankMax rule, the same way missing votes count as zero.
// AniList has no rank at all, so the rule is skipped there like the vote checks.
function verdictFor(source: BadgeSource, score: Score, rank: number | undefined, t: ThresholdSet): Verdict {
  const votes = score.votes ?? 0;
  const votesOk = (min: number) => !hasVotes(source, score) || votes >= min;
  const { highly, recommended, maybe } = t;
  const rankOk = highly.rankMax === undefined || source === 'anilist' || (rank !== undefined && rank <= highly.rankMax);
  if (score.value >= highly.score && votesOk(highly.votes) && rankOk) return 'highly_recommended';
  if (score.value >= recommended.score && votesOk(recommended.votes)) return 'recommended';
  if (score.value >= maybe.score) return 'maybe';
  return 'skip';
}

export function quickVerdict(info: TitleInfo, thresholds: Thresholds): QuickBadge {
  const picked = pickSource(info);
  if (!picked) return NO_BADGE;
  const { source, score } = picked;
  const set = thresholds[THRESHOLD_SET[source]];
  const rank = info.kind === 'anime' ? info.rank : undefined;
  return {
    verdict: verdictFor(source, score, rank, set),
    source,
    score,
    lowVotes: hasVotes(source, score) && (score.votes ?? 0) < set.lowVotesBelow,
  };
}
