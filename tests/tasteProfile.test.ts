import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../src/background/cache';
import { buildProfile, getTasteProfile } from '../src/background/taste/tasteProfile';
import { createTasteStore, type RatedTitle } from '../src/background/taste/tasteStore';
import type { Kind } from '../src/shared/types';

const NOW = new Date(2026, 9, 31).getTime();

let seq = 0;
function rated(rating: 'up' | 'down', extra: Partial<RatedTitle> = {}, kind: Kind = 'anime'): RatedTitle {
  seq += 1;
  return { id: `id:${seq}`, kind, rating, genres: [], makers: [], ratedAt: seq, ...extra };
}

describe('buildProfile', () => {
  it('is empty with no ratings', () => {
    expect(buildProfile([], 'anime', 0, NOW)).toEqual({
      kind: 'anime',
      version: 0,
      count: { up: 0, down: 0 },
      likedGenres: [],
      dislikedGenres: [],
    });
  });

  it('counts only its own kind', () => {
    const ratings = [rated('up'), rated('down'), rated('up', {}, 'movie')];
    const profile = buildProfile(ratings, 'anime', 4, NOW);
    expect(profile.count).toEqual({ up: 1, down: 1 });
    expect(profile.version).toBe(4);
    expect(buildProfile(ratings, 'movie', 1, NOW).count).toEqual({ up: 1, down: 0 });
  });

  it('ranks genres by net count, then name, and puts each in one list', () => {
    const ratings = [
      rated('up', { genres: ['Fantasy', 'Drama', 'Action'] }),
      rated('up', { genres: ['Fantasy', 'Drama'] }),
      rated('up', { genres: ['Fantasy', 'Comedy'] }),
      rated('down', { genres: ['Drama', 'Ecchi', 'Comedy'] }),
      rated('down', { genres: ['Ecchi', 'Harem'] }),
    ];
    const profile = buildProfile(ratings, 'anime', 1, NOW);
    expect(profile.likedGenres).toEqual(['Fantasy', 'Action', 'Drama']);
    expect(profile.dislikedGenres).toEqual(['Ecchi', 'Harem']);
  });

  it('counts a genre listed twice on one title once', () => {
    const profile = buildProfile([rated('up', { genres: ['Drama', 'Drama'] }), rated('down', { genres: ['Drama'] })], 'anime', 1, NOW);
    expect(profile.likedGenres).toEqual([]);
    expect(profile.dislikedGenres).toEqual([]);
  });

  it('caps each genre list at 6', () => {
    const genres = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const profile = buildProfile([rated('up', { genres }), rated('down', { genres: genres.map((g) => `x${g}`) })], 'anime', 1, NOW);
    expect(profile.likedGenres).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(profile.dislikedGenres).toHaveLength(6);
  });

  it('takes the median length of liked titles once two have one', () => {
    expect(buildProfile([rated('up', { length: 12 }), rated('up')], 'anime', 1, NOW).preferredLength).toBeUndefined();
    const two = [rated('up', { length: 12 }), rated('up', { length: 25 }), rated('down', { length: 500 })];
    expect(buildProfile(two, 'anime', 1, NOW).preferredLength).toBe(19);
    const three = [...two, rated('up', { length: 64 })];
    expect(buildProfile(three, 'anime', 1, NOW).preferredLength).toBe(25);
  });

  it('needs three liked titles with a year for an era', () => {
    const two = [rated('up', { year: 2024 }), rated('up', { year: 2023 }), rated('up'), rated('down', { year: 2025 })];
    expect(buildProfile(two, 'anime', 1, NOW).era).toBeUndefined();
  });

  it('calls the era new at 70% within ten years, old at 30%, mixed between', () => {
    const recent = (n: number) => Array.from({ length: n }, () => rated('up', { year: 2016 }));
    const older = (n: number) => Array.from({ length: n }, () => rated('up', { year: 2015 }));
    expect(buildProfile([...recent(7), ...older(3)], 'anime', 1, NOW).era).toBe('new');
    expect(buildProfile([...recent(6), ...older(4)], 'anime', 1, NOW).era).toBe('mixed');
    expect(buildProfile([...recent(4), ...older(6)], 'anime', 1, NOW).era).toBe('mixed');
    expect(buildProfile([...recent(3), ...older(7)], 'anime', 1, NOW).era).toBe('old');
  });

  it('lists makers liked at least twice, top 3', () => {
    const ratings = [
      rated('up', { makers: ['Madhouse', 'MAPPA'] }),
      rated('up', { makers: ['Madhouse', 'Bones'] }),
      rated('up', { makers: ['Madhouse', 'Bones', 'MAPPA'] }),
      rated('up', { makers: ['Trigger', 'Ufotable'] }),
      rated('up', { makers: ['Ufotable'] }),
      rated('down', { makers: ['Trigger'] }),
    ];
    expect(buildProfile(ratings, 'anime', 1, NOW).topMakers).toEqual(['Madhouse', 'Bones', 'MAPPA']);
    expect(buildProfile([rated('up', { makers: ['A'] })], 'anime', 1, NOW).topMakers).toBeUndefined();
  });
});

describe('getTasteProfile', () => {
  it('reads ratings and the kind version from the store', async () => {
    const data = new Map<string, unknown>();
    const store: KeyValueStore = {
      get: async (k) => data.get(k),
      set: async (k, v) => void data.set(k, v),
      remove: async (k) => void data.delete(k),
      keys: async () => [...data.keys()],
    };
    const taste = createTasteStore(store, () => NOW);
    const info = {
      id: 'mal:1',
      kind: 'anime' as const,
      title: 'X',
      genres: ['Fantasy'],
      scores: [],
      match: { query: 'X', matchedName: 'X', confidence: 1, source: 'mal' as const },
      format: 'TV',
      status: 'Finished Airing',
      aired: {},
      studios: [],
    };
    await taste.rate(info, 'up');
    const profile = await getTasteProfile('anime', taste, () => NOW);
    expect(profile).toMatchObject({ version: 1, count: { up: 1, down: 0 }, likedGenres: ['Fantasy'] });
    expect((await getTasteProfile('movie', taste, () => NOW)).version).toBe(0);
  });
});
