// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { TasteProfile } from '../src/background/taste/tasteProfile';
import { renderTasteBody, tasteTiles } from '../src/options/tasteView';
import { renderThresholdSection } from '../src/options/thresholdView';
import { DEFAULT_THRESHOLDS } from '../src/shared/settings';

const empty = (kind: TasteProfile['kind']): TasteProfile => ({
  kind,
  version: 0,
  count: { up: 0, down: 0 },
  likedGenres: [],
  dislikedGenres: [],
});

describe('tasteTiles', () => {
  it('shows counts, median length in episodes and the era for anime', () => {
    const profile: TasteProfile = { ...empty('anime'), count: { up: 8, down: 4 }, preferredLength: 26, era: 'new' };
    expect(tasteTiles(profile)).toEqual([
      { label: 'Đã đánh giá', value: '12', note: '8 thích · 4 không thích' },
      { label: 'Ngưỡng số tập', value: '≤ 26 tập', note: 'trung vị các anime thích' },
      { label: 'Thời kỳ', value: 'Mới', note: 'ưa anime ≤ 10 năm tuổi' },
    ]);
  });

  it('uses minutes for movies and says when data is missing', () => {
    const [, length, era] = tasteTiles(empty('movie'));
    expect(length).toEqual({ label: 'Ngưỡng thời lượng', value: 'Chưa đủ dữ liệu', note: 'cần 2 tựa đã thích có số phút' });
    expect(era).toMatchObject({ value: 'Chưa đủ dữ liệu' });
    expect(tasteTiles({ ...empty('movie'), preferredLength: 118, era: 'old' })[1]!.value).toBe('≤ 118 phút');
    expect(tasteTiles({ ...empty('series'), era: 'mixed' })[2]!.value).toBe('Pha trộn');
  });
});

describe('renderTasteBody', () => {
  it('draws liked and disliked chips, or a placeholder when empty', () => {
    const el = renderTasteBody({ ...empty('anime'), likedGenres: ['Fantasy', 'Drama'], dislikedGenres: [] });
    expect([...el.querySelectorAll('.chip-liked')].map((c) => c.textContent)).toEqual(['Fantasy', 'Drama']);
    expect(el.querySelectorAll('.chip-disliked')).toHaveLength(0);
    expect(el.querySelector('.chips-empty')?.textContent).toBe('Chưa có');
    expect(el.querySelectorAll('.tile')).toHaveLength(3);
  });
});

describe('renderThresholdSection', () => {
  it('fills, reads and marks bad fields', () => {
    const onSave = vi.fn();
    const view = renderThresholdSection('mal', { onSave, onReset: vi.fn() });
    view.fill(DEFAULT_THRESHOLDS.mal);
    expect(view.element.querySelector('h2')?.textContent).toBe('Ngưỡng nhãn nhanh · Anime (MAL)');
    expect(view.element.querySelectorAll('.trow')).toHaveLength(4);
    expect(view.read()).toMatchObject({ highlyScore: '8.0', highlyVotes: '100000', rankMax: '500' });
    view.showErrors([{ key: 'maybeScore', message: 'sai' }]);
    expect(view.element.querySelector('#th-mal-maybeScore')?.getAttribute('aria-invalid')).toBe('true');
    expect(view.element.querySelector('.field-errors')?.textContent).toBe('sai');
    view.element.querySelector<HTMLButtonElement>('.btn-primary')!.click();
    expect(onSave).toHaveBeenCalledWith(view);
    view.fill(DEFAULT_THRESHOLDS.mal);
    expect(view.element.querySelector('[aria-invalid]')).toBeNull();
  });

  it('has no rank field for TMDB', () => {
    const view = renderThresholdSection('tmdb', { onSave: vi.fn(), onReset: vi.fn() });
    expect(view.element.querySelector('#th-tmdb-rankMax')).toBeNull();
    expect(view.element.querySelector('h2')?.textContent).toBe('Ngưỡng nhãn nhanh · Phim và series (TMDB, khi không có IMDb)');
  });
});
