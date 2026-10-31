// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { anilistIcon, imdbIcon, malIcon, metacriticIcon, rtIcon, scoreIcon, tmdbIcon } from '../src/content/popover/scoreIcons';

function fills(svg: SVGSVGElement): string[] {
  return [...svg.querySelectorAll('[fill]')].map((n) => n.getAttribute('fill') ?? '');
}

describe('score icons', () => {
  it.each([
    ['imdb', imdbIcon()],
    ['rt', rtIcon(90)],
    ['metacritic', metacriticIcon(80)],
    ['tmdb', tmdbIcon()],
    ['mal', malIcon()],
    ['anilist', anilistIcon()],
  ])('%s builds an aria-hidden svg 16px high', (_name, svg) => {
    expect(svg.tagName).toBe('svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('height')).toBe('16');
  });

  it('rt is a tomato at 60 and a splat at 59', () => {
    expect(fills(rtIcon(60))).toContain('#fa320a');
    expect(rtIcon(60).querySelector('circle')).not.toBeNull();
    expect(fills(rtIcon(59))).toEqual(['#6bb533']);
    expect(rtIcon(59).querySelector('circle')).toBeNull();
  });

  it('metacritic colours by band', () => {
    const bg = (n: number) => metacriticIcon(n).querySelector('rect')?.getAttribute('fill');
    expect(bg(40)).toBe('#ffcc33');
    expect(bg(39)).toBe('#ff0000');
    expect(bg(41)).toBe('#ffcc33');
    expect(bg(60)).toBe('#ffcc33');
    expect(bg(61)).toBe('#66cc33');
    expect(metacriticIcon(50).querySelector('text')?.getAttribute('fill')).toBe('#000000');
    expect(metacriticIcon(80).querySelector('text')?.getAttribute('fill')).toBe('#ffffff');
  });

  it('scoreIcon dispatches by source', () => {
    expect(scoreIcon('imdb', 7).textContent).toBe('IMDb');
    expect(scoreIcon('tmdb', 7).textContent).toBe('TMDB');
    expect(scoreIcon('mal', 7).textContent).toBe('MAL');
    expect(scoreIcon('anilist', 7).textContent).toBe('AniList');
  });
});
