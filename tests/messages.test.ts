import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendLookup } from '../src/shared/messages';

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
