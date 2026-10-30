import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRateRequest, isRatingGetRequest, sendLookup } from '../src/shared/messages';

describe('sendLookup', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('turns a synchronous sendMessage throw into a rejection', async () => {
    const sendMessage = vi.fn(() => {
      throw new Error('Extension context invalidated.');
    });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });

    const pending = sendLookup({ title: 'Frieren', lang: 'en' });

    await expect(pending).rejects.toThrow('Extension context invalidated.');
  });

  it('resolves with the response on success', async () => {
    const response = { status: 'no_match' };
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(async () => response) } });

    await expect(sendLookup({ title: 'Frieren', lang: 'en' })).resolves.toBe(response);
  });
});

describe('rating message guards', () => {
  const info = { id: 'mal:1', kind: 'anime' };

  it('accepts up, down and null ratings with an info', () => {
    expect(isRateRequest({ type: 'rate', info, rating: 'up' })).toBe(true);
    expect(isRateRequest({ type: 'rate', info, rating: null })).toBe(true);
    expect(isRateRequest({ type: 'rate', info, rating: 'meh' })).toBe(false);
    expect(isRateRequest({ type: 'rate', rating: 'up' })).toBe(false);
  });

  it('needs an id and a known kind for rating-get', () => {
    expect(isRatingGetRequest({ type: 'rating-get', id: 'mal:1', kind: 'anime' })).toBe(true);
    expect(isRatingGetRequest({ type: 'rating-get', id: 'mal:1', kind: 'game' })).toBe(false);
    expect(isRatingGetRequest({ type: 'rating-get', kind: 'movie' })).toBe(false);
  });
});
