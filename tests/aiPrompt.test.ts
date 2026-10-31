import { describe, expect, it } from 'vitest';
import type { OpinionInput } from '../src/background/ai/AIProvider';
import { needSummary } from '../src/shared/needSummary';
import { buildMessages } from '../src/background/ai/prompt';
import { quickVerdict } from '../src/shared/quickBadge';
import { DEFAULT_THRESHOLDS } from '../src/shared/settings';
import type { AnimeInfo, MovieInfo } from '../src/shared/types';

const anime: AnimeInfo = {
  id: 'mal:52991',
  kind: 'anime',
  title: 'Sousou no Frieren',
  year: 2023,
  synopsis: { text: 'The elf mage Frieren outlives her companions.', lang: 'en' },
  genres: ['Adventure', 'Fantasy'],
  scores: [{ source: 'mal', value: 9.3, votes: 560412 }],
  match: { query: 'Frieren', matchedName: 'Sousou no Frieren', confidence: 1, source: 'mal' },
  format: 'TV',
  episodes: 28,
  status: 'Finished Airing',
  aired: {},
  studios: ['Madhouse'],
};

const movie: MovieInfo = {
  id: 'tmdb:movie:398978',
  kind: 'movie',
  title: 'The Irishman',
  year: 2019,
  synopsis: { text: 'Một sát thủ già nhìn lại cuộc đời.', lang: 'vi' },
  genres: ['Tội phạm'],
  scores: [{ source: 'imdb', value: 7.8, votes: 1_200_000 }],
  match: { query: 'The Irishman', matchedName: 'The Irishman', confidence: 0.97, source: 'tmdb' },
  runtimeMin: 209,
  directors: ['Martin Scorsese'],
  cast: [],
};

const taste = { kind: 'anime' as const, version: 3, count: { up: 2, down: 1 }, likedGenres: ['Fantasy'], dislikedGenres: [] };

function input(info: AnimeInfo | MovieInfo): OpinionInput {
  return { info, taste, badge: quickVerdict(info, DEFAULT_THRESHOLDS), needSummary: needSummary(info) };
}

describe('buildMessages', () => {
  it('mentions json in the system prompt, as DeepSeek JSON mode requires', () => {
    const [system] = buildMessages(input(anime));
    expect(system?.role).toBe('system');
    expect(system?.content).toContain('json');
    for (const v of ['highly_recommended', 'recommended', 'maybe', 'skip']) expect(system?.content).toContain(v);
  });

  it('asks for a written summary when needSummary is true', () => {
    const [system] = buildMessages(input(anime));
    expect(system?.content).toContain('spoiler-free Vietnamese summary');
    expect(system?.content).not.toContain('unchanged');
  });

  it('asks to copy the overview when needSummary is false', () => {
    const [system] = buildMessages(input(movie));
    expect(system?.content).toContain('copy title.synopsis.text exactly');
    expect(system?.content).not.toContain('spoiler-free Vietnamese summary');
  });

  it('writes in English and copies an English overview in the English locale', () => {
    const [write] = buildMessages(input(anime), 'en');
    expect(write?.content).toContain('spoiler-free English summary');
    expect(write?.content).toContain('All text values must be in English');
    expect(write?.content).toContain('_vi suffix');
    expect(write?.content).not.toContain('Vietnamese');
    const [copy] = buildMessages({ ...input(anime), needSummary: false }, 'en');
    expect(copy?.content).toContain('already an overview in English');
  });

  it('sends title data, the quick badge and the taste profile, without match', () => {
    const [, user] = buildMessages(input(anime));
    const payload = JSON.parse(user!.content);
    expect(payload.title.match).toBeUndefined();
    expect(user!.content).not.toContain('"match"');
    expect(payload.title).toMatchObject({
      title: 'Sousou no Frieren',
      year: 2023,
      episodes: 28,
      studios: ['Madhouse'],
      genres: ['Adventure', 'Fantasy'],
      scores: [{ source: 'mal', value: 9.3, votes: 560412 }],
      synopsis: { text: 'The elf mage Frieren outlives her companions.', lang: 'en' },
    });
    expect(payload.quick_badge).toEqual({ verdict: 'recommended', source: 'mal', score: 9.3, votes: 560412, low_votes: false });
    expect(payload.taste_profile).toEqual({ count: { up: 2, down: 1 }, likedGenres: ['Fantasy'], dislikedGenres: [] });
  });
});

describe('scores without votes', () => {
  it('omits votes from the payload and tells the model the count is unknown', () => {
    const keyless = { ...movie, scores: [{ source: 'imdb' as const, value: 8.7 }] };
    const [system, user] = buildMessages(input(keyless));
    const payload = JSON.parse(user!.content);
    expect(payload.quick_badge).toEqual({ verdict: 'highly_recommended', source: 'imdb', score: 8.7, low_votes: false });
    expect(user!.content).not.toContain('"votes"');
    expect(system!.content).toContain('never as zero');
  });
});

describe('needSummary', () => {
  it('is true for foreign-language or missing synopses in Vietnamese', () => {
    expect(needSummary(anime, 'vi')).toBe(true);
    expect(needSummary({ ...anime, synopsis: undefined }, 'vi')).toBe(true);
    expect(needSummary(movie, 'vi')).toBe(false);
    expect(needSummary({ ...movie, synopsis: { text: 'x', lang: 'en' } }, 'vi')).toBe(true);
    expect(needSummary({ ...movie, synopsis: undefined }, 'vi')).toBe(true);
    expect(needSummary({ ...movie, synopsis: { text: '  ', lang: 'vi' } }, 'vi')).toBe(true);
  });

  it('is false for an English synopsis in English', () => {
    expect(needSummary(anime, 'en')).toBe(false);
    expect(needSummary({ ...movie, synopsis: { text: 'x', lang: 'en' } }, 'en')).toBe(false);
    expect(needSummary({ ...movie, synopsis: { text: 'x', lang: 'vi' } }, 'en')).toBe(true);
    expect(needSummary({ ...movie, synopsis: undefined }, 'en')).toBe(true);
  });
});
