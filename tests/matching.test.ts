import { describe, expect, it } from 'vitest';
import { MATCH_THRESHOLD, bestMatch, matchConfidence, nameSimilarity } from '../src/shared/normalize';

function candidate(names: string[], extra: { year?: number; tieBreak?: number; id?: string } = {}) {
  return { names, year: extra.year, tieBreak: extra.tieBreak ?? 0, id: extra.id ?? names[0]! };
}

const frieren = candidate(
  ['Sousou no Frieren', "Frieren: Beyond Journey's End", '葬送のフリーレン', 'Frieren at the Funeral'],
  { year: 2023, tieBreak: 1_000_000 },
);
const aot = candidate(['Shingeki no Kyojin', 'Attack on Titan', '進撃の巨人', 'AoT', '진격의 거인'], {
  year: 2013,
  tieBreak: 4_000_000,
});

describe('nameSimilarity', () => {
  it('is 1 for an exact normalized match', () => {
    expect(nameSimilarity('ATTACK ON TITAN!', 'Attack on Titan')).toBe(1);
  });

  it('is a bigram Dice score otherwise', () => {
    // "night" vs "nacht": bigrams ni ig gh ht / na ac ch ht share one, so 2*1/8.
    expect(nameSimilarity('night', 'nacht')).toBeCloseTo(0.25);
  });

  it('ignores spaces when comparing bigrams', () => {
    expect(nameSimilarity('Spy x Family', 'SpyxFamily')).toBe(1);
  });

  it('is 0 when either side normalizes to nothing', () => {
    expect(nameSimilarity('!!!', 'Attack on Titan')).toBe(0);
  });
});

describe('matchConfidence', () => {
  it('takes the best name the candidate has', () => {
    expect(matchConfidence("Frieren: Beyond Journey's End", undefined, frieren)).toEqual({
      confidence: 1,
      matchedName: "Frieren: Beyond Journey's End",
    });
  });

  it('scores the romaji name low against the English query', () => {
    const romajiOnly = { names: ['Sousou no Frieren'] };
    expect(matchConfidence("Frieren: Beyond Journey's End", undefined, romajiOnly)!.confidence).toBeLessThan(
      MATCH_THRESHOLD,
    );
  });

  it('adds 0.05 for an equal year and clamps at 1', () => {
    const near = { names: ['Attack on Titan Season'], year: 2013 };
    const without = matchConfidence('Attack on Titan', undefined, near)!.confidence;
    expect(matchConfidence('Attack on Titan', 2013, near)!.confidence).toBeCloseTo(without + 0.05);
    expect(matchConfidence('Attack on Titan', 2013, aot)!.confidence).toBe(1);
  });

  it('leaves a year one off unchanged', () => {
    expect(matchConfidence('Attack on Titan', 2014, aot)!.confidence).toBe(1);
  });

  it('subtracts 0.2 for a year more than one off', () => {
    expect(matchConfidence('Attack on Titan', 2023, aot)!.confidence).toBeCloseTo(0.8);
  });

  it('returns null for a candidate with no names', () => {
    expect(matchConfidence('Attack on Titan', undefined, { names: [] })).toBeNull();
  });
});

describe('bestMatch', () => {
  it('matches the English name of a romaji-titled show', () => {
    const result = bestMatch('Attack on Titan', undefined, [frieren, aot]);
    expect(result?.candidate.id).toBe('Shingeki no Kyojin');
    expect(result?.matchedName).toBe('Attack on Titan');
    expect(result?.confidence).toBe(1);
  });

  it('matches Frieren by its English name', () => {
    const result = bestMatch("Frieren: Beyond Journey's End", 2023, [aot, frieren]);
    expect(result?.candidate).toBe(frieren);
    expect(result?.confidence).toBe(1);
  });

  it('returns null for a live-action title against unrelated anime', () => {
    const results = [
      candidate(['The Irishman Seiyuu Hen'], { tieBreak: 10 }),
      candidate(['Irish Tales', 'Airishu']),
      aot,
      frieren,
    ];
    expect(bestMatch('The Irishman', 2019, results)).toBeNull();
  });

  it('drops a near match when the year is far off', () => {
    expect(bestMatch('Attack on Titan', 2023, [aot])).toBeNull();
  });

  it('gives a tie to the candidate with more members', () => {
    const film = candidate(['One Piece', 'One Piece Movie 1'], { id: 'film', tieBreak: 120_000, year: 2000 });
    const tv = candidate(['One Piece', 'ワンピース'], { id: 'tv', tieBreak: 2_400_000, year: 1999 });
    const red = candidate(['One Piece Film: Red'], { id: 'red', tieBreak: 300_000, year: 2022 });
    expect(bestMatch('One Piece', undefined, [film, red, tv])?.candidate.id).toBe('tv');
    expect(bestMatch('One Piece', undefined, [tv, film, red])?.candidate.id).toBe('tv');
  });

  it('matches a Japanese script query', () => {
    const result = bestMatch('葬送のフリーレン', undefined, [aot, frieren]);
    expect(result?.candidate).toBe(frieren);
    expect(result?.matchedName).toBe('葬送のフリーレン');
  });

  it('matches a Korean script query with spacing differences', () => {
    const result = bestMatch('진격의거인', undefined, [frieren, aot]);
    expect(result?.candidate).toBe(aot);
    expect(result?.matchedName).toBe('진격의 거인');
  });

  it('matches a German query that shares the English name', () => {
    const result = bestMatch('Frieren – Nach dem Ende der Reise', undefined, [
      candidate(['Sousou no Frieren', 'Frieren - Nach dem Ende der Reise']),
    ]);
    expect(result?.confidence).toBe(1);
  });

  it('matches a Vietnamese query against an unaccented synonym', () => {
    const result = bestMatch('Đảo Hải Tặc', undefined, [candidate(['One Piece', 'Dao Hai Tac'])]);
    expect(result?.matchedName).toBe('Dao Hai Tac');
  });
});
