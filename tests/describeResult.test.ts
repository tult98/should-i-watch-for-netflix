import { describe, expect, it } from 'vitest';
import { compactCount, describeResult, describeScores } from '../src/content/describeResult';
import type { AnimeInfo, TitleInfo } from '../src/shared/types';

describe('describeResult', () => {
  it('prints kind, match, id and scores in a fixed order', () => {
    const info = {
      id: 'tmdb:movie:398978',
      kind: 'movie',
      match: { query: 'The Irishman', matchedName: 'The Irishman', confidence: 0.996, source: 'tmdb' },
      scores: [
        { source: 'tmdb', value: 8.438, votes: 12_345 },
        { source: 'metacritic', value: 80 },
        { source: 'rt', value: 94 },
        { source: 'imdb', value: 8.5, votes: 2_100_000 },
      ],
    } as TitleInfo;
    expect(describeResult({ status: 'match', info })).toBe(
      'movie The Irishman 100% tmdb:movie:398978 imdb=8.5(2.1M) rt=94% mc=80 tmdb=8.4(12k)',
    );
  });

  it('describes an AniList score and an IMDb score without a vote count', () => {
    const anime = {
      id: 'mal:52991', kind: 'anime', title: 'Frieren', genres: [], format: 'TV', status: 'Finished Airing', aired: {}, studios: [],
      match: { query: 'Frieren', matchedName: 'Frieren', confidence: 1, source: 'anilist' },
      scores: [{ source: 'anilist', value: 9.1 }],
    } as unknown as AnimeInfo;
    expect(describeResult({ status: 'match', info: anime })).toBe('anime Frieren 100% mal:52991 anilist=9.1');
    expect(describeScores([{ source: 'imdb', value: 8.7 }])).toBe('imdb=8.7');
  });

  it('keeps two MAL decimals and drops an empty score list', () => {
    const anime = {
      id: 'mal:269',
      kind: 'anime',
      match: { query: 'Bleach', matchedName: 'Bleach', confidence: 1, source: 'mal' },
      scores: [{ source: 'mal', value: 7.95, votes: 560_400 }],
    } as TitleInfo;
    expect(describeResult({ status: 'match', info: anime })).toBe('anime Bleach 100% mal:269 mal=7.95(560k)');
    expect(describeResult({ status: 'match', info: { ...anime, scores: [] } })).toBe('anime Bleach 100% mal:269');
  });

  it('prints no_match and errors', () => {
    expect(describeResult({ status: 'no_match' })).toBe('no_match');
    expect(describeResult({ status: 'error', reason: 'bad_tmdb_key' })).toBe('error bad_tmdb_key');
  });

  it('compacts vote counts', () => {
    expect(compactCount(950)).toBe('950');
    expect(compactCount(1_234)).toBe('1.2k');
    expect(compactCount(560_400)).toBe('560k');
    expect(compactCount(999_700)).toBe('1M');
    expect(compactCount(2_000_000)).toBe('2M');
  });
});
