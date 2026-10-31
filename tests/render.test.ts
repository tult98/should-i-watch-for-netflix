// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyAiError, applyAiResult, isAiLoading, setAiLoading } from '../src/content/popover/ai';
import { renderLoading, renderTitle } from '../src/content/popover/render';
import type { AiOk } from '../src/shared/messages';
import { quickVerdict } from '../src/shared/quickBadge';
import { DEFAULT_THRESHOLDS } from '../src/shared/settings';
import type { AnimeInfo, MovieInfo, SeriesInfo, TitleInfo } from '../src/shared/types';

const now = new Date(2026, 9, 31);

const frieren: AnimeInfo = {
  id: 'mal:52991',
  kind: 'anime',
  title: 'Sousou no Frieren',
  year: 2023,
  synopsis: { text: 'After the demon king falls, the elf mage Frieren outlives her companions.', lang: 'en' },
  genres: ['Adventure', 'Drama', 'Fantasy'],
  scores: [{ source: 'mal', value: 9.3, votes: 560412 }],
  match: { query: 'Frieren', matchedName: 'Sousou no Frieren', confidence: 1, source: 'mal' },
  format: 'TV',
  episodes: 28,
  status: 'Finished Airing',
  demographic: 'Shounen',
  rank: 1,
  popularity: 123,
  members: 1_300_000,
  season: 'Fall 2023',
  aired: { from: '2023-09-29T00:00:00+00:00', to: '2024-03-22T00:00:00+00:00' },
  studios: ['Madhouse'],
};

const irishman: MovieInfo = {
  id: 'tmdb:movie:398978',
  kind: 'movie',
  title: 'The Irishman',
  year: 2019,
  synopsis: { text: 'Một sát thủ già nhìn lại cuộc đời.', lang: 'vi' },
  genres: ['Tội phạm', 'Chính kịch'],
  scores: [
    { source: 'tmdb', value: 7.6, votes: 8200 },
    { source: 'imdb', value: 7.8, votes: 1_200_000 },
    { source: 'rt', value: 95 },
    { source: 'metacritic', value: 94 },
  ],
  match: { query: 'The Irishman', matchedName: 'The Irishman', confidence: 0.97, source: 'tmdb' },
  runtimeMin: 209,
  directors: ['Martin Scorsese'],
  cast: ['Robert De Niro', 'Al Pacino', 'Joe Pesci', 'Harvey Keitel'],
  certification: 'R',
  releaseDate: '2019-11-01',
};

const lights: SeriesInfo = {
  id: 'tmdb:tv:1',
  kind: 'series',
  title: 'Những Ngọn Đèn Cuối Phố',
  year: 2021,
  synopsis: { text: 'Five families on one street.', lang: 'en' },
  genres: ['Chính kịch'],
  scores: [{ source: 'tmdb', value: 8.4, votes: 12306 }],
  match: { query: 'x', matchedName: 'Những Ngọn Đèn Cuối Phố', confidence: 1, source: 'tmdb' },
  seasons: 3,
  episodes: 28,
  status: 'ended',
  startYear: 2021,
  endYear: 2024,
  creators: ['Đỗ Khánh Linh'],
  cast: ['Vũ Hải Đăng', 'Bùi Thu Hà'],
  certification: 'T16',
};

function render(info: TitleInfo): HTMLElement {
  return renderTitle(info, quickVerdict(info, DEFAULT_THRESHOLDS), now);
}

function iconCount(el: Element): number {
  return el.querySelectorAll('svg.score-icon[aria-hidden="true"]').length;
}

function expectIcons(el: HTMLElement): void {
  expect(iconCount(el.querySelector('.score-label') as Element)).toBe(1);
  const stats = [...el.querySelectorAll('.stat')];
  expect(stats.length).toBeGreaterThan(0);
  for (const stat of stats) expect(iconCount(stat)).toBe(1);
}

function statLabels(el: HTMLElement): string[] {
  return [...el.querySelectorAll('.stat .label')].map((n) => n.textContent ?? '');
}

describe('renderTitle anime', () => {
  const el = render(frieren);
  const text = el.textContent ?? '';

  it('shows the MAL header, badge, title and match line', () => {
    expect(el.querySelector('.pill')?.textContent).toBe('MAL');
    expect(text).toContain('MyAnimeList');
    expect(el.querySelector('.badge')?.textContent).toBe('Rất nên xem');
    expect(el.querySelector('.badge')?.classList.contains('badge-highly_recommended')).toBe(true);
    expect(el.querySelector('.title')?.textContent).toBe('Sousou no Frieren (2023)');
    expect(text).toContain('Khớp MAL: Sousou no Frieren · độ tin cậy 100%');
  });

  it('shows the score, stats, synopsis, meta, aired and chips', () => {
    expect(el.querySelector('.score-value')?.textContent).toBe('9.30');
    expect(text).toContain('bởi 560.412 người chấm');
    expect(statLabels(el)).toEqual(['Ranked', 'Popularity', 'Members']);
    expect([...el.querySelectorAll('.stat-value')].map((n) => n.textContent)).toEqual(['#1', '#123', '1,3M']);
    expect(text).toContain('Tóm tắt (MAL, tiếng Anh)');
    expect(el.querySelector('.synopsis-en')).not.toBeNull();
    expect(text).toContain('Đã chiếu xong');
    expect(text).toContain('Fall 2023');
    expect(text).toContain('Sep 2023 – Mar 2024');
    expect(el.querySelector('.age')?.textContent).toBe('Vài năm trước');
    expect(el.querySelector('.chip-outline')?.textContent).toBe('Shounen');
    expect(el.querySelectorAll('button')).toHaveLength(3);
    expect(el.querySelector('.warn')).toBeNull();
  });

  it('adds an IMDb stat for an anime with an imdb score', () => {
    const movie = render({ ...frieren, scores: [...frieren.scores, { source: 'imdb', value: 8.6, votes: 400000 }] });
    expect(statLabels(movie)).toEqual(['Ranked', 'Popularity', 'Members', 'IMDb']);
  });

  it('shows the low votes warning and skip badge', () => {
    const low = render({ ...frieren, scores: [{ source: 'mal', value: 6.12, votes: 4120 }] });
    expect(low.querySelector('.warn')?.textContent).toBe('Ít người chấm, điểm chưa đáng tin');
    expect(low.querySelector('.badge')?.textContent).toBe('Bỏ qua');
  });

  it('hides sections whose data is missing', () => {
    const sparse = render({
      ...frieren,
      year: undefined,
      synopsis: undefined,
      genres: [],
      demographic: undefined,
      scores: [],
      rank: undefined,
      popularity: undefined,
      members: undefined,
      episodes: undefined,
      season: undefined,
      status: 'Unknown',
      format: 'Unknown',
      aired: {},
    });
    expect(sparse.querySelector('.title')?.textContent).toBe('Sousou no Frieren');
    for (const cls of ['.badge', '.score', '.warn', '.stats', '.synopsis', '.meta', '.age', '.chips']) {
      expect(sparse.querySelector(cls), cls).toBeNull();
    }
    expect(sparse.textContent).not.toContain('Thời gian chiếu');
    expect(sparse.querySelectorAll('button')).toHaveLength(3);
  });
});

describe('renderTitle movie', () => {
  const el = render(irishman);
  const text = el.textContent ?? '';

  it('uses the imdb score as the headline and leaves it out of the stats row', () => {
    expect(el.querySelector('.pill')?.textContent).toBe('TMDB');
    expect(el.querySelector('.note')?.textContent).toBe('Phim lẻ');
    expect(el.querySelector('.score-value')?.textContent).toBe('7.8');
    expect(el.querySelector('.score-source')?.textContent).toBe('IMDb');
    expect(text).toContain('bởi 1.200.000 lượt chấm');
    expect(statLabels(el)).toEqual(['Rotten Tomatoes', 'Metacritic']);
    expect(el.querySelector('.badge')?.textContent).toBe('Nên xem');
  });

  it('shows synopsis, meta, release, credits and genres', () => {
    expect(text).toContain('Khớp TMDB: The Irishman · độ tin cậy 97%');
    expect(el.querySelector('.section .label')?.textContent).toBe('Tóm tắt');
    expect(text).toContain('3 giờ 29 phút');
    expect(text).toContain('Độ tuổi');
    expect(text).toContain('Ra mắt');
    expect(text).toContain('Tháng 11, 2019');
    expect(text).toContain('Đạo diễn');
    expect(text).toContain('Robert De Niro, Al Pacino, Joe Pesci');
    expect(text).not.toContain('Harvey Keitel');
    expect([...el.querySelectorAll('.chip')].map((n) => n.textContent)).toEqual(['Tội phạm', 'Chính kịch']);
  });

  it('falls back to the tmdb headline and hides an empty stats row', () => {
    const tmdbOnly = render({ ...irishman, scores: [{ source: 'tmdb', value: 7.6, votes: 300 }] });
    expect(tmdbOnly.querySelector('.score-source')?.textContent).toBe('TMDB');
    expect(tmdbOnly.querySelector('.score-value')?.textContent).toBe('7.6');
    expect(tmdbOnly.querySelector('.stats')).toBeNull();
    expect(tmdbOnly.querySelector('.warn')).not.toBeNull();
  });
});

describe('renderTitle series', () => {
  const el = render(lights);
  const text = el.textContent ?? '';

  it('shows the series layout with tmdb headline', () => {
    expect(el.querySelector('.note')?.textContent).toBe('Series');
    expect(el.querySelector('.score-source')?.textContent).toBe('TMDB');
    expect(el.querySelector('.stats')).toBeNull();
    expect(text).toContain('Tóm tắt (tiếng Anh)');
    expect(text).toContain('Số mùa');
    expect(text).toContain('Đã kết thúc');
    expect(text).toContain('T16');
    expect(text).toContain('Thời gian chiếu');
    expect(text).toContain('2021 – 2024');
    expect(text).toContain('Sáng tạo');
    expect(el.querySelector('[aria-label="Thích tiêu đề này"]')).not.toBeNull();
  });

  it('lists IMDb, Rotten Tomatoes and TMDB, minus the headline', () => {
    const full = render({
      ...lights,
      scores: [...lights.scores, { source: 'imdb', value: 8.5, votes: 200000 }, { source: 'rt', value: 94 }],
    });
    expect(full.querySelector('.score-source')?.textContent).toBe('IMDb');
    expect(statLabels(full)).toEqual(['Rotten Tomatoes', 'TMDB']);
  });

  it('gives a lone stats cell half the row and keeps two cells at two columns', () => {
    const cols = (node: HTMLElement) => (node.querySelector('.stats') as HTMLElement).style.getPropertyValue('--cols');
    const one = render({ ...lights, scores: [...lights.scores, { source: 'imdb', value: 8.5, votes: 200000 }] });
    expect(statLabels(one)).toEqual(['TMDB']);
    expect(cols(one)).toBe('2');
    const two = render({
      ...lights,
      scores: [...lights.scores, { source: 'imdb', value: 8.5, votes: 200000 }, { source: 'rt', value: 94 }],
    });
    expect(cols(two)).toBe('2');
  });
});

describe('render safety', () => {
  it('renders hostile titles as text', () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const el = render({
      ...frieren,
      title: hostile,
      genres: [hostile],
      synopsis: { text: hostile, lang: 'en' },
      match: { ...frieren.match, matchedName: hostile },
    });
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.title')?.textContent).toBe(`${hostile} (2023)`);
    expect(el.querySelector('.chip')?.textContent).toBe(hostile);
  });
});

describe('renderLoading', () => {
  it('renders the skeleton with pulsing blocks and no badge', () => {
    const el = renderLoading();
    expect(el.querySelectorAll('.sk').length).toBeGreaterThan(5);
    expect(el.querySelector('.badge')).toBeNull();
    expect(el.textContent).toContain('Đang tra cứu…');
  });
});

function aiOk(over: Partial<AiOk> = {}): AiOk {
  return {
    status: 'ok',
    opinion: { summary_vi: 'Tóm tắt tiếng Việt.', verdict: 'highly_recommended', reason_vi: 'Điểm rất cao.' },
    providerLabel: 'DeepSeek',
    model: 'deepseek-chat',
    tasteCount: 12,
    fromCache: false,
    ...over,
  };
}

function aiLabel(el: HTMLElement): string | null | undefined {
  return el.querySelector('.btn-ai-label')?.textContent;
}

describe('AI block', () => {
  it('starts with an empty slot and the AI nhận xét button', () => {
    const el = render(frieren);
    expect(el.querySelector('.ai-slot')?.childElementCount).toBe(0);
    expect(aiLabel(el)).toBe('AI nhận xét');
  });

  it('calls the onAi hook on click', () => {
    let clicks = 0;
    const el = renderTitle(frieren, quickVerdict(frieren, DEFAULT_THRESHOLDS), now, { onAi: () => clicks++ });
    el.querySelector<HTMLButtonElement>('.btn-ai')?.click();
    expect(clicks).toBe(1);
  });

  it('shows the loading state on the button', () => {
    const el = render(frieren);
    setAiLoading(el, true);
    expect(aiLabel(el)).toBe('Đang hỏi AI…');
    expect(el.querySelector<HTMLButtonElement>('.btn-ai')?.disabled).toBe(true);
    expect(isAiLoading(el)).toBe(true);
    setAiLoading(el, false);
    expect(aiLabel(el)).toBe('AI nhận xét');
  });

  it('renders the anime opinion per the design and replaces the English synopsis', () => {
    const el = render(frieren);
    setAiLoading(el, true);
    applyAiResult(el, frieren, aiOk());
    const box = el.querySelector('.ai-box')!;
    expect(box.querySelector('.ai-title')?.textContent).toBe('AI nhận xét');
    expect(box.querySelector('.ai-provider')?.textContent).toBe('DeepSeek · deepseek-chat');
    expect(box.querySelector('.ai-verdict-label')?.textContent).toBe('Kết luận:');
    const badge = box.querySelector('.badge')!;
    expect(badge.textContent).toBe('Rất nên xem');
    expect(badge.classList.contains('badge-highly_recommended')).toBe(true);
    expect(box.querySelector('.ai-reason')?.textContent).toBe('Điểm rất cao.');
    expect(box.querySelector('.ai-foot')?.textContent).toBe('Đã tính đến hồ sơ gu Anime của bạn (12 đánh giá)');
    expect(el.querySelector('.synopsis-section .label')?.textContent).toBe('Tóm tắt');
    expect(el.querySelector('.synopsis')?.textContent).toBe('Tóm tắt tiếng Việt.');
    expect(el.querySelector('.synopsis-en')).toBeNull();
    expect(aiLabel(el)).toBe('Đánh giá lại theo gu');
    expect(el.querySelector<HTMLButtonElement>('.btn-ai')?.disabled).toBe(false);
  });

  it('keeps a Vietnamese TMDB overview and hints at rating when there is no taste profile', () => {
    const el = render(irishman);
    applyAiResult(el, irishman, aiOk({ tasteCount: 0, opinion: { ...aiOk().opinion, summary_vi: 'Khác.' } }));
    expect(el.querySelector('.synopsis')?.textContent).toBe('Một sát thủ già nhìn lại cuộc đời.');
    expect(el.querySelector('.ai-foot')?.textContent).toContain('👍');
    expect(el.querySelector('.ai-foot')?.textContent).toContain('Phim lẻ');
  });

  it('adds a Tóm tắt section when the title had no synopsis', () => {
    const bare = { ...lights, synopsis: undefined };
    const el = render(bare);
    expect(el.querySelector('.synopsis')).toBeNull();
    applyAiResult(el, bare, aiOk());
    expect(el.querySelector('.synopsis-section .label')?.textContent).toBe('Tóm tắt');
    expect(el.querySelector('.synopsis-section + .ai-slot')).not.toBeNull();
  });

  it('renders model text as text', () => {
    const el = render(frieren);
    const hostile = '<img src=x onerror="alert(1)">';
    applyAiResult(el, frieren, aiOk({ opinion: { summary_vi: hostile, verdict: 'skip', reason_vi: hostile } }));
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.ai-reason')?.textContent).toBe(hostile);
  });

  it('shows a missing key error with a button that opens the settings', () => {
    const el = render(frieren);
    let opened = 0;
    setAiLoading(el, true);
    applyAiError(el, 'missing_ai_key', () => opened++);
    const line = el.querySelector('.ai-error')!;
    expect(line.textContent).toBe('Thêm API key cho AI để nhận xét, mở trang cài đặt');
    line.querySelector<HTMLButtonElement>('button')?.click();
    expect(opened).toBe(1);
    expect(aiLabel(el)).toBe('AI nhận xét');
    expect(el.querySelector<HTMLButtonElement>('.btn-ai')?.disabled).toBe(false);
  });

  it('shows other errors as one line without a button', () => {
    const el = render(frieren);
    applyAiError(el, 'ai_no_balance', () => {});
    expect(el.querySelector('.ai-error')?.textContent).toBe('Tài khoản AI đã hết số dư');
    expect(el.querySelector('.ai-error button')).toBeNull();
  });
});

describe('score icons in the popover', () => {
  it('movie has icons in the headline label and every stats cell', () => expectIcons(render(irishman)));

  it('series has icons in the headline label and every stats cell', () => {
    const scores = [
      ...lights.scores,
      { source: 'imdb' as const, value: 8.1, votes: 50000 },
      { source: 'rt' as const, value: 88 },
    ];
    expectIcons(render({ ...lights, scores }));
  });

  it('anime has a MAL icon in the headline label and none on MAL-only stats', () => {
    const el = render(frieren);
    expect(el.querySelector('.score-label svg')?.textContent).toBe('MAL');
    expect(iconCount(el.querySelector('.stats') as Element)).toBe(0);
  });

  it('anime with IMDb has an IMDb icon in its IMDb cell', () => {
    const el = render({ ...frieren, scores: [...frieren.scores, { source: 'imdb', value: 8.6, votes: 400000 }] });
    const cellsWithIcon = [...el.querySelectorAll('.stat')].filter((n) => n.querySelector('svg'));
    expect(cellsWithIcon).toHaveLength(1);
    expect(cellsWithIcon[0]?.querySelector('svg')?.textContent).toBe('IMDb');
    expect(cellsWithIcon[0]?.querySelector('.label')?.textContent).toBe('IMDb');
  });

  it('keeps the visible label text for screen readers', () => {
    expect(render(irishman).querySelector('.score-source')?.textContent).toBe('IMDb');
  });
});

describe('renderTitle keyless sources', () => {
  const anilistFrieren: AnimeInfo = {
    ...frieren,
    scores: [{ source: 'anilist', value: 9.1 }],
    match: { query: 'Frieren', matchedName: 'Sousou no Frieren', confidence: 1, source: 'anilist' },
    rank: undefined,
    popularity: undefined,
  };
  const cinemetaFilm: MovieInfo = {
    ...irishman,
    scores: [{ source: 'imdb', value: 7.8 }],
    match: { query: 'The Irishman', matchedName: 'The Irishman', confidence: 1, source: 'cinemeta' },
  };

  it('headlines an AniList anime without votes or a low votes warning', () => {
    const el = render(anilistFrieren);
    expect(el.querySelector('.pill')?.textContent).toBe('AniList');
    expect(el.querySelector('.score-source')?.textContent).toBe('AniList');
    expect(el.querySelector('.score-value')?.textContent).toBe('9.1');
    expect(el.querySelector('.badge')?.textContent).toBe('Rất nên xem');
    expect(el.querySelector('.warn')).toBeNull();
    expect(el.querySelector('.score-meta')?.textContent).not.toMatch(/\d/);
    expect(el.textContent).toContain('Khớp AniList: Sousou no Frieren');
    expect(el.textContent).not.toContain('MyAnimeList');
    expect(statLabels(el)).toEqual(['Members']);
  });

  it('headlines a Cinemeta film with an IMDb score and no vote count', () => {
    const el = render(cinemetaFilm);
    expect(el.querySelector('.pill')?.textContent).toBe('Cinemeta');
    expect(el.querySelector('.score-source')?.textContent).toBe('IMDb');
    expect(el.querySelector('.score-value')?.textContent).toBe('7.8');
    expect(el.querySelector('.score-meta')?.textContent).not.toMatch(/\d/);
    expect(el.querySelector('.warn')).toBeNull();
    expect(el.textContent).not.toMatch(/\b0 (lượt|votes)/);
    expect(el.querySelector('.badge')?.textContent).toBe('Nên xem');
  });
});
