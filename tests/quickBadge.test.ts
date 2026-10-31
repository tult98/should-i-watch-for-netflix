import { describe, expect, it } from 'vitest';
import { quickVerdict } from '../src/shared/quickBadge';
import { DEFAULT_THRESHOLDS } from '../src/shared/settings';
import type { AnimeInfo, MovieInfo, Score, SeriesInfo } from '../src/shared/types';

const match = { query: 'x', matchedName: 'x', confidence: 1, source: 'mal' as const };

function anime(scores: Score[], rank?: number): AnimeInfo {
  return {
    id: 'mal:1', kind: 'anime', title: 'A', genres: [], scores, match,
    format: 'TV', status: 'Finished Airing', aired: {}, studios: [], rank,
  };
}

function movie(scores: Score[]): MovieInfo {
  return {
    id: 'tmdb:movie:1', kind: 'movie', title: 'M', genres: [], scores,
    match: { ...match, source: 'tmdb' }, directors: [], cast: [],
  };
}

function series(scores: Score[]): SeriesInfo {
  return {
    id: 'tmdb:tv:1', kind: 'series', title: 'S', genres: [], scores,
    match: { ...match, source: 'tmdb' }, status: 'ended', creators: [], cast: [],
  };
}

const t = DEFAULT_THRESHOLDS;

describe('quickVerdict mal', () => {
  const v = (value: number, votes: number, rank = 1) => quickVerdict(anime([{ source: 'mal', value, votes }], rank), t).verdict;

  it('highly at 8.0, 100000 votes, rank 500', () => {
    expect(v(8.0, 100_000, 500)).toBe('highly_recommended');
    expect(v(7.99, 100_000, 500)).toBe('recommended');
    expect(v(8.0, 99_999, 500)).toBe('recommended');
  });

  it('drops out of highly when the rank is past rankMax or missing', () => {
    expect(v(9.0, 500_000, 501)).toBe('recommended');
    const unranked = quickVerdict(anime([{ source: 'mal', value: 9.0, votes: 500_000 }]), t);
    expect(unranked.verdict).toBe('recommended');
  });

  it('recommended at 7.5 and 30000 votes', () => {
    expect(v(7.5, 30_000)).toBe('recommended');
    expect(v(7.49, 30_000)).toBe('maybe');
    expect(v(7.5, 29_999)).toBe('maybe');
  });

  it('maybe at 7.0 regardless of votes, skip below', () => {
    expect(v(7.0, 0)).toBe('maybe');
    expect(v(6.99, 1_000_000)).toBe('skip');
  });

  it('flags low votes under 10000', () => {
    const at = quickVerdict(anime([{ source: 'mal', value: 7, votes: 10_000 }]), t);
    const under = quickVerdict(anime([{ source: 'mal', value: 7, votes: 9_999 }]), t);
    expect(at.lowVotes).toBe(false);
    expect(under.lowVotes).toBe(true);
  });

  it('uses mal even when the anime has an imdb score', () => {
    const b = quickVerdict(anime([{ source: 'imdb', value: 9, votes: 1e6 }, { source: 'mal', value: 6, votes: 1e5 }]), t);
    expect(b).toMatchObject({ verdict: 'skip', source: 'mal', score: { value: 6 } });
  });

  it('has no badge without a mal score', () => {
    expect(quickVerdict(anime([{ source: 'imdb', value: 9, votes: 1e6 }]), t).verdict).toBeNull();
  });
});

describe('quickVerdict imdb', () => {
  const v = (value: number, votes: number) =>
    quickVerdict(movie([{ source: 'imdb', value, votes }, { source: 'tmdb', value: 1, votes: 1 }]), t);

  it('checks every imdb boundary', () => {
    expect(v(8.0, 100_000).verdict).toBe('highly_recommended');
    expect(v(8.0, 99_999).verdict).toBe('recommended');
    expect(v(7.2, 20_000).verdict).toBe('recommended');
    expect(v(7.19, 20_000).verdict).toBe('maybe');
    expect(v(7.2, 19_999).verdict).toBe('maybe');
    expect(v(6.5, 0).verdict).toBe('maybe');
    expect(v(6.49, 1e6).verdict).toBe('skip');
  });

  it('prefers imdb over tmdb and reports the source', () => {
    expect(v(7.8, 1_200_000)).toMatchObject({ source: 'imdb', score: { source: 'imdb', value: 7.8 } });
  });

  it('flags low votes under 5000', () => {
    expect(v(7, 5_000).lowVotes).toBe(false);
    expect(v(7, 4_999).lowVotes).toBe(true);
  });

  it('skips the vote checks when the count is unknown', () => {
    expect(quickVerdict(movie([{ source: 'imdb', value: 9 }]), t)).toMatchObject({ verdict: 'highly_recommended', lowVotes: false });
    expect(quickVerdict(movie([{ source: 'imdb', value: 7.2 }]), t).verdict).toBe('recommended');
    expect(quickVerdict(movie([{ source: 'imdb', value: 6.5 }]), t).verdict).toBe('maybe');
    expect(quickVerdict(movie([{ source: 'imdb', value: 6.4 }]), t).verdict).toBe('skip');
  });

  it('still checks the votes when the count is known', () => {
    expect(quickVerdict(movie([{ source: 'imdb', value: 9, votes: 0 }]), t)).toMatchObject({ verdict: 'maybe', lowVotes: true });
  });
});

describe('quickVerdict anilist', () => {
  const v = (value: number, rank?: number) => quickVerdict(anime([{ source: 'anilist', value }], rank), t);

  it('badges an anime from AniList with the anime thresholds and no vote checks', () => {
    expect(v(8.0)).toMatchObject({ verdict: 'highly_recommended', source: 'anilist', lowVotes: false });
    expect(v(7.99).verdict).toBe('recommended');
    expect(v(7.5).verdict).toBe('recommended');
    expect(v(7.49).verdict).toBe('maybe');
    expect(v(7.0).verdict).toBe('maybe');
    expect(v(6.99).verdict).toBe('skip');
  });

  it('has no rank to hold against it', () => {
    expect(v(9.1, undefined).verdict).toBe('highly_recommended');
  });

  it('follows custom anime thresholds', () => {
    const custom = { ...t, mal: { ...t.mal, maybe: { score: 6.0 } } };
    expect(quickVerdict(anime([{ source: 'anilist', value: 6.5 }]), t).verdict).toBe('skip');
    expect(quickVerdict(anime([{ source: 'anilist', value: 6.5 }]), custom).verdict).toBe('maybe');
  });

  it('prefers a MAL score over AniList', () => {
    const b = quickVerdict(anime([{ source: 'anilist', value: 9 }, { source: 'mal', value: 6, votes: 1e5 }]), t);
    expect(b).toMatchObject({ verdict: 'skip', source: 'mal' });
  });
});

describe('quickVerdict mal and tmdb keep the zero rule for unknown votes', () => {
  it('mal', () => {
    expect(quickVerdict(anime([{ source: 'mal', value: 9 }], 1), t)).toMatchObject({ verdict: 'maybe', lowVotes: true });
  });

  it('tmdb', () => {
    expect(quickVerdict(series([{ source: 'tmdb', value: 9 }]), t)).toMatchObject({ verdict: 'maybe', lowVotes: true });
  });
});

describe('quickVerdict tmdb', () => {
  const v = (value: number, votes: number) => quickVerdict(series([{ source: 'tmdb', value, votes }]), t);

  it('falls back to tmdb without an imdb score', () => {
    expect(v(8.4, 12_306)).toMatchObject({ verdict: 'highly_recommended', source: 'tmdb', lowVotes: false });
  });

  it('checks every tmdb boundary', () => {
    expect(v(8.0, 5_000).verdict).toBe('highly_recommended');
    expect(v(8.0, 4_999).verdict).toBe('recommended');
    expect(v(7.2, 2_000).verdict).toBe('recommended');
    expect(v(7.19, 2_000).verdict).toBe('maybe');
    expect(v(7.2, 1_999).verdict).toBe('maybe');
    expect(v(6.5, 0).verdict).toBe('maybe');
    expect(v(6.49, 1e5).verdict).toBe('skip');
  });

  it('flags low votes under 500', () => {
    expect(v(7, 500).lowVotes).toBe(false);
    expect(v(7, 499).lowVotes).toBe(true);
  });

  it('ignores rt and metacritic as badge sources', () => {
    const b = quickVerdict(movie([{ source: 'rt', value: 95 }, { source: 'metacritic', value: 90 }]), t);
    expect(b).toEqual({ verdict: null, source: null, score: null, lowVotes: false });
  });

  it('uses custom thresholds from settings', () => {
    const custom = { ...t, tmdb: { ...t.tmdb, maybe: { score: 8.5 } } };
    expect(quickVerdict(series([{ source: 'tmdb', value: 8.4, votes: 10 }]), custom).verdict).toBe('skip');
  });
});
