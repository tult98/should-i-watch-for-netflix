// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { applyRateClick, currentRating, nextRating, setRating } from '../src/content/popover/rating';
import { renderTitle } from '../src/content/popover/render';
import { quickVerdict } from '../src/shared/quickBadge';
import { DEFAULT_THRESHOLDS } from '../src/shared/settings';
import type { AnimeInfo, Rating } from '../src/shared/types';

const info: AnimeInfo = {
  id: 'mal:1',
  kind: 'anime',
  title: 'Frieren',
  genres: [],
  scores: [{ source: 'mal', value: 9.3, votes: 500_000 }],
  match: { query: 'Frieren', matchedName: 'Frieren', confidence: 1, source: 'mal' },
  format: 'TV',
  status: 'Finished Airing',
  aired: {},
  studios: [],
};

function popover(onRate?: (r: Rating) => void): HTMLElement {
  return renderTitle(info, quickVerdict(info, DEFAULT_THRESHOLDS), new Date(2026, 9, 31), { onRate });
}

function pressed(root: HTMLElement): (string | null)[] {
  return [...root.querySelectorAll('.btn-rate')].map((b) => b.getAttribute('aria-pressed'));
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('nextRating', () => {
  it('sets, clears and flips', () => {
    expect(nextRating(null, 'up')).toBe('up');
    expect(nextRating('up', 'up')).toBeNull();
    expect(nextRating('up', 'down')).toBe('down');
    expect(nextRating('down', 'down')).toBeNull();
  });
});

describe('popover rating buttons', () => {
  it('render unpressed and call onRate with the clicked value', () => {
    const onRate = vi.fn();
    const root = popover(onRate);
    expect(pressed(root)).toEqual(['false', 'false']);
    root.querySelector<HTMLButtonElement>('.btn-rate[data-rating="down"]')!.click();
    expect(onRate).toHaveBeenCalledWith('down');
  });

  it('setRating presses at most one button', () => {
    const root = popover();
    setRating(root, 'up');
    expect(pressed(root)).toEqual(['true', 'false']);
    expect(currentRating(root)).toBe('up');
    setRating(root, 'down');
    expect(pressed(root)).toEqual(['false', 'true']);
    setRating(root, null);
    expect(currentRating(root)).toBeNull();
  });

  it('applyRateClick toggles optimistically and keeps the stored answer', async () => {
    const root = popover();
    const send = vi.fn(async (next: Rating | null) => ({ rating: next }));
    await applyRateClick(root, 'up', send);
    expect(currentRating(root)).toBe('up');
    await applyRateClick(root, 'up', send);
    expect(currentRating(root)).toBeNull();
    await applyRateClick(root, 'down', send);
    await applyRateClick(root, 'up', send);
    expect(currentRating(root)).toBe('up');
    expect(send.mock.calls.map((c) => c[0])).toEqual(['up', null, 'down', 'up']);
  });

  it('reverts when the message fails', async () => {
    const root = popover();
    setRating(root, 'down');
    await expect(applyRateClick(root, 'up', async () => Promise.reject(new Error('gone')))).rejects.toThrow('gone');
    expect(currentRating(root)).toBe('down');
  });

  it('applies only the answer to the newest click', async () => {
    const root = popover();
    const first = deferred<{ rating: Rating | null }>();
    const second = deferred<{ rating: Rating | null }>();
    const p1 = applyRateClick(root, 'up', () => first.promise);
    expect(currentRating(root)).toBe('up');
    const p2 = applyRateClick(root, 'up', () => second.promise);
    expect(currentRating(root)).toBeNull();
    first.resolve({ rating: 'up' });
    await p1;
    expect(currentRating(root)).toBeNull();
    second.resolve({ rating: null });
    await p2;
    expect(currentRating(root)).toBeNull();
  });
});
