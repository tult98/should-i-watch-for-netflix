// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { RatedTitle } from '../src/background/taste/tasteStore';
import { popupModel } from '../src/popup/model';
import { renderPopup, type PopupHandlers } from '../src/popup/view';
import type { Kind } from '../src/shared/types';

function rated(id: string, kind: Kind): RatedTitle {
  return { id, kind, rating: 'up', genres: [], makers: [], ratedAt: 0 };
}

const ALL_KEYS = { malClientId: 'm', tmdbKey: 't', omdbKey: 'o', aiKey: 'sk' };

describe('popupModel', () => {
  it('marks every key as set with no notes', () => {
    const model = popupModel(ALL_KEYS, []);
    expect(model.keys.map((k) => [k.label, k.status, k.note])).toEqual([
      ['MyAnimeList Client ID', 'Đã cài', undefined],
      ['TMDB', 'Đã cài', undefined],
      ['OMDb', 'Đã cài', undefined],
      ['AI (DeepSeek)', 'Đã cài', undefined],
    ]);
    expect(model.keys.every((k) => k.set)).toBe(true);
  });

  it('says what each missing key costs', () => {
    const model = popupModel({}, []);
    expect(model.keys.map((k) => [k.key, k.set, k.status, k.note])).toEqual([
      ['malClientId', false, 'Chưa cài', 'Đang dùng Jikan, có thể không ổn định'],
      ['tmdbKey', false, 'Chưa cài', 'Phim và series cần TMDB key'],
      ['omdbKey', false, 'Chưa cài', 'Không có điểm IMDb, Rotten Tomatoes, Metacritic'],
      ['aiKey', false, 'Chưa cài', 'Nút AI nhận xét không dùng được'],
    ]);
  });

  it('counts ratings per kind', () => {
    const ratings = [
      ...Array.from({ length: 8 }, (_, i) => rated(`a${i}`, 'anime')),
      ...Array.from({ length: 3 }, (_, i) => rated(`m${i}`, 'movie')),
      rated('s1', 'series'),
      rated('s2', 'series'),
    ];
    expect(popupModel({}, ratings)).toMatchObject({ ratings: 'Anime 8 · Phim lẻ 3 · Series 2', hasRatings: true });
    expect(popupModel({}, [rated('m', 'movie')]).ratings).toBe('Anime 0 · Phim lẻ 1 · Series 0');
  });

  it('shows a hint when nothing is rated', () => {
    expect(popupModel({}, [])).toMatchObject({ hasRatings: false, ratings: expect.stringContaining('Chưa đánh giá') });
  });

  it('is on unless the switch is stored off', () => {
    expect(popupModel({}, []).enabled).toBe(true);
    expect(popupModel({ enabled: true }, []).enabled).toBe(true);
    expect(popupModel({ enabled: false }, []).enabled).toBe(false);
  });
});

function handlers(overrides: Partial<PopupHandlers> = {}): PopupHandlers {
  return { toggle: vi.fn(async () => {}), openSettings: vi.fn(), clearCache: vi.fn(async () => 0), ...overrides };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('renderPopup', () => {
  it('draws the name, a key row per key and a green chip only for saved keys', () => {
    const el = renderPopup(popupModel({ tmdbKey: 't' }, []), handlers(), 'App');
    expect(el.querySelector('h1')?.textContent).toBe('App');
    expect(el.querySelectorAll('.key-row')).toHaveLength(4);
    expect(el.querySelector('[data-key="tmdbKey"] .chip-set')?.textContent).toBe('Đã cài');
    expect(el.querySelectorAll('.chip-missing')).toHaveLength(3);
  });

  it('flips the switch and saves it, and puts it back when the save fails', async () => {
    const toggle = vi.fn(async () => {});
    const el = renderPopup(popupModel({}, []), handlers({ toggle }), 'App');
    const sw = el.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(sw.getAttribute('aria-checked')).toBe('true');
    sw.click();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(toggle).toHaveBeenCalledWith(false);
    await flush();

    toggle.mockRejectedValueOnce(new Error('quota'));
    sw.click();
    await flush();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(el.querySelector('.switch-row .status')?.textContent).toBe('Không lưu được');
  });

  it('opens settings and reports how many cache entries were cleared', async () => {
    const h = handlers({ clearCache: vi.fn(async () => 5) });
    const el = renderPopup(popupModel({}, []), h, 'App');
    const [open, clear] = el.querySelectorAll<HTMLButtonElement>('.btn');
    open!.click();
    expect(h.openSettings).toHaveBeenCalledOnce();
    clear!.click();
    await flush();
    expect(el.querySelector('.actions .status')?.textContent).toBe('Đã xóa 5 mục');
  });
});
