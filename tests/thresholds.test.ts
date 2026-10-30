import { describe, expect, it } from 'vitest';
import { saveThresholdSet } from '../src/options/save';
import { parseThresholdForm, thresholdFormValues, thresholdRows } from '../src/options/thresholds';
import { DEFAULT_THRESHOLDS, SETTINGS_KEY, loadSettings, thresholdsOf, type SettingsStore } from '../src/shared/settings';

function memoryStore(): SettingsStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return { data, get: async (k) => data.get(k), set: async (k, v) => void data.set(k, v) };
}

describe('thresholdRows', () => {
  it('has a rank field only for MAL and counts people for anime, votes for film', () => {
    const keys = (set: 'mal' | 'tmdb') => thresholdRows(set).map((r) => r.fields.map((f) => f.key));
    expect(keys('mal')).toEqual([
      ['highlyScore', 'highlyVotes', 'rankMax'],
      ['recommendedScore', 'recommendedVotes'],
      ['maybeScore'],
      ['lowVotesBelow'],
    ]);
    expect(keys('tmdb')[0]).toEqual(['highlyScore', 'highlyVotes']);
    expect(thresholdRows('mal')[0]!.fields[1]!.label).toBe('Số người chấm ≥');
    expect(thresholdRows('imdb')[0]!.fields[1]!.label).toBe('Số lượt chấm ≥');
  });
});

describe('parseThresholdForm', () => {
  it('round-trips every default set', () => {
    for (const set of ['mal', 'imdb', 'tmdb'] as const) {
      expect(parseThresholdForm(set, thresholdFormValues(DEFAULT_THRESHOLDS[set]))).toEqual({
        ok: true,
        value: DEFAULT_THRESHOLDS[set],
      });
    }
  });

  it('trims whitespace and drops an empty rank', () => {
    const values = { ...thresholdFormValues(DEFAULT_THRESHOLDS.mal), highlyScore: ' 8.5 ', rankMax: '' };
    const result = parseThresholdForm('mal', values);
    expect(result).toEqual({ ok: true, value: { ...DEFAULT_THRESHOLDS.mal, highly: { score: 8.5, votes: 100_000 } } });
  });

  it('rejects non-numeric, negative, fractional counts, empty and out-of-range scores', () => {
    const values = {
      ...thresholdFormValues(DEFAULT_THRESHOLDS.tmdb),
      highlyScore: 'abc',
      highlyVotes: '-5',
      recommendedVotes: '20.5',
      maybeScore: '11',
      lowVotesBelow: '',
    };
    const result = parseThresholdForm('tmdb', values);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      { key: 'highlyScore', message: 'Rất nên xem, Score ≥: phải là số không âm' },
      { key: 'highlyVotes', message: 'Rất nên xem, Số lượt chấm ≥: phải là số không âm' },
      { key: 'recommendedVotes', message: 'Nên xem, Số lượt chấm ≥: phải là số nguyên không âm' },
      { key: 'maybeScore', message: 'Cân nhắc, Score ≥: phải từ 0 đến 10' },
      { key: 'lowVotesBelow', message: 'Cảnh báo, Số lượt chấm <: chưa nhập' },
    ]);
  });

  it('rejects a comma decimal', () => {
    const result = parseThresholdForm('imdb', { ...thresholdFormValues(DEFAULT_THRESHOLDS.imdb), maybeScore: '6,5' });
    expect(result.ok).toBe(false);
  });
});

describe('saveThresholdSet', () => {
  it('replaces one set and keeps the others and the keys', async () => {
    const store = memoryStore();
    store.data.set(SETTINGS_KEY, { tmdbKey: 'k' });
    const tmdb = { ...DEFAULT_THRESHOLDS.tmdb, lowVotesBelow: 50 };
    await saveThresholdSet('tmdb', tmdb, store);
    const settings = await loadSettings(store);
    expect(settings.tmdbKey).toBe('k');
    expect(thresholdsOf(settings)).toEqual({ ...DEFAULT_THRESHOLDS, tmdb });
  });
});
