import type { Rating } from '../../shared/types';

export function nextRating(current: Rating | null, clicked: Rating): Rating | null {
  return current === clicked ? null : clicked;
}

function rateButton(root: HTMLElement, rating: Rating): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`.btn-rate[data-rating="${rating}"]`);
}

export function currentRating(root: HTMLElement): Rating | null {
  if (rateButton(root, 'up')?.getAttribute('aria-pressed') === 'true') return 'up';
  if (rateButton(root, 'down')?.getAttribute('aria-pressed') === 'true') return 'down';
  return null;
}

export function setRating(root: HTMLElement, rating: Rating | null): void {
  for (const value of ['up', 'down'] as const) {
    rateButton(root, value)?.setAttribute('aria-pressed', String(rating === value));
  }
}

const latest = new WeakMap<HTMLElement, number>();

// The button flips at once; only the answer to the newest click may correct it, so fast double clicks don't flicker.
export async function applyRateClick(
  root: HTMLElement,
  clicked: Rating,
  send: (next: Rating | null) => Promise<{ rating: Rating | null }>,
): Promise<void> {
  const previous = currentRating(root);
  const next = nextRating(previous, clicked);
  const token = (latest.get(root) ?? 0) + 1;
  latest.set(root, token);
  setRating(root, next);
  try {
    const response = await send(next);
    if (latest.get(root) === token) setRating(root, response.rating);
  } catch (err) {
    if (latest.get(root) === token) setRating(root, previous);
    throw err;
  }
}
