// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AnimeInfo, MovieInfo } from '../src/shared/types';
import { DEFAULT_THRESHOLDS } from '../src/shared/settings';

const now = new Date(2026, 9, 31);

const frieren: AnimeInfo = {
  id: 'mal:52991',
  kind: 'anime',
  title: 'Sousou no Frieren',
  year: 2023,
  synopsis: { text: 'The elf mage Frieren outlives her companions.', lang: 'en' },
  genres: ['Fantasy'],
  scores: [{ source: 'mal', value: 9.3, votes: 560412 }],
  match: { query: 'Frieren', matchedName: 'Sousou no Frieren', confidence: 1, source: 'mal' },
  format: 'TV',
  episodes: 28,
  status: 'Finished Airing',
  aired: { from: '2023-09-29T00:00:00+00:00', to: '2024-03-22T00:00:00+00:00' },
  studios: ['Madhouse'],
};

const irishman: MovieInfo = {
  id: 'tmdb:movie:398978',
  kind: 'movie',
  title: 'The Irishman',
  year: 2019,
  synopsis: { text: 'An aging hitman looks back.', lang: 'en' },
  genres: ['Crime'],
  scores: [{ source: 'tmdb', value: 7.6, votes: 8200 }],
  match: { query: 'The Irishman', matchedName: 'The Irishman', confidence: 0.97, source: 'tmdb' },
  runtimeMin: 209,
  directors: [],
  cast: [],
};

let renderTitle: typeof import('../src/content/popover/render').renderTitle;
let quickVerdict: typeof import('../src/shared/quickBadge').quickVerdict;

beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'en-US' } });
  ({ renderTitle } = await import('../src/content/popover/render'));
  ({ quickVerdict } = await import('../src/shared/quickBadge'));
  vi.unstubAllGlobals();
});

describe('popover in English', () => {
  it('shows an English synopsis plainly, without an English tag', () => {
    const el = renderTitle(frieren, quickVerdict(frieren, DEFAULT_THRESHOLDS), now);
    expect(el.querySelector('.synopsis-section .label')?.textContent).toBe('Synopsis');
    expect(el.querySelector('.synopsis-en')).toBeNull();
    expect(el.textContent).toContain('560,412');
    expect(el.textContent).toContain('Finished airing');
  });

  it('renders movie fields in English', () => {
    const el = renderTitle(irishman, quickVerdict(irishman, DEFAULT_THRESHOLDS), now);
    expect(el.textContent).toContain('3 h 29 min');
    expect(el.querySelector('.synopsis-en')).toBeNull();
  });
});
