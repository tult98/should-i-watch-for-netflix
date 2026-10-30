// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { findCard, readTitle } from '../src/content/netflixSelectors';

describe('findCard with nested markup', () => {
  document.body.innerHTML = `
    <div class="slider-item">
      <div class="title-card-container">
        <div class="title-card">
          <a aria-label="Frieren"><img alt="poster" /></a>
        </div>
      </div>
    </div>`;
  const sliderItem = document.querySelector('.slider-item')!;

  it.each([
    ['img', 'img'],
    ['link', 'a'],
    ['.title-card', '.title-card'],
  ])('resolves the outermost wrapper from the %s', (_name, selector) => {
    expect(findCard(document.querySelector(selector)!)).toBe(sliderItem);
  });

  it('reads the title from the card', () => {
    expect(readTitle(sliderItem)).toBe('Frieren');
  });
});
