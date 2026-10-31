// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  findCard,
  findOpenPreview,
  findPreview,
  readNetflixId,
  readPreviewId,
  readTitle,
  readYear,
} from '../src/content/netflixSelectors';

function renderPage(metadata: string) {
  document.body.innerHTML = `
    <section data-uia="carousel-row-section-0">
      <div data-uia="carousel-scroller">
        <button data-uia="carousel-hawkins-left-button"><span>prev</span></button>
        <div>
          <div data-virtual-slot="5">
            <div><div>
              <a href="/browse?jbv=70204957" tabindex="0" aria-label="Bleach" data-uia="progress-card">
                <div><div><img id="bleach-img" src="b.jpg" alt="" class="continue-watching-card tracked-card"></div></div>
              </a>
            </div></div>
          </div>
          <div data-virtual-slot="6">
            <div><div>
              <a href="/title/81091393" tabindex="0" aria-label="Frieren" data-uia="standard-card">
                <div><div><img src="f.jpg" alt=""></div></div>
              </a>
            </div></div>
          </div>
        </div>
        <div data-uia="episodic-card+still"><img alt=""></div>
        <div data-uia="card-image-overlay"><div data-uia="card-image-logo"></div></div>
        <div data-uia="carousel-hawkins-right-button-peek-scrim"></div>
      </div>
    </section>
    <div data-uia="modal-motion-container-MINI_MODAL" role="dialog">
      <div data-uia="previewModal--player_container"></div>
      <div data-uia="previewModal--info-container">
        <div data-uia="previewModal--metadatAndControls">
          <div data-uia="mini-modal-controls"><button>Play</button></div>
          <div data-uia="videoMetadata--container"><span>${metadata}</span></div>
        </div>
      </div>
    </div>`;
}

const q = (selector: string) => document.querySelector(selector)!;

describe('netflixSelectors', () => {
  beforeEach(() => renderPage('Show T16 4 Seasons HD'));

  it('resolves the card anchor from its image', () => {
    expect(findCard(q('#bleach-img'))).toBe(q('[aria-label="Bleach"]'));
  });

  it.each([
    ['left arrow button', '[data-uia="carousel-hawkins-left-button"] span'],
    ['right arrow scrim', '[data-uia="carousel-hawkins-right-button-peek-scrim"]'],
    ['episodic-card+still', '[data-uia="episodic-card+still"] img'],
    ['card-image-overlay', '[data-uia="card-image-overlay"]'],
    ['card-image-logo', '[data-uia="card-image-logo"]'],
  ])('finds no card from the %s', (_name, selector) => {
    expect(findCard(q(selector))).toBeNull();
  });

  it('finds no card from an episode card', () => {
    document.body.innerHTML = `<div data-virtual-slot="6"><div><div><a href="/browse?jbv=70196252" tabindex="0" aria-label="Pilot" data-uia="episodic-card"><div data-uia="episodic-card+still"><div><div><img alt="" class="standard-episodic-card tracked-card"><div data-uia="card-image-overlay"><div data-uia="card-image-bottom-start"><img alt="" data-is-card-logo="true" data-uia="card-image-logo"></div><div data-uia="card-image-bottom-end"><div data-uia="card-image-duration"><span>58m</span></div></div></div></div></div></div><div><h3><span>Pilot</span></h3><p>Drama • T18</p></div></a></div></div></div>`;
    expect(findCard(q('img.standard-episodic-card'))).toBeNull();
    expect(findCard(q('h3 span'))).toBeNull();
    expect(findCard(q('[data-uia="episodic-card"]'))).toBeNull();
  });

  it('reads title and Netflix id from both href shapes', () => {
    const bleach = q('[data-uia="progress-card"]');
    const frieren = q('[data-uia="standard-card"]');
    expect([readTitle(bleach), readNetflixId(bleach)]).toEqual(['Bleach', '70204957']);
    expect([readTitle(frieren), readNetflixId(frieren)]).toEqual(['Frieren', '81091393']);
  });

  describe('New & Popular card', () => {
    const title = 'The Exiled Heavy Knight Knows How To Game the System';

    beforeEach(() => {
      document.body.innerHTML = `<div class="title-card-container" data-uia="title-card-container"><div id="title-card-0-0" class="title-card"><div class="ptrack-content"><a href="/watch/82942166?tctx=0%2C0%2C%2C%2C%2C%2C%2C%2C%2CVideo%3A82942166%2C" role="link" aria-label="${title}" tabindex="0" aria-hidden="false" class="slider-refocus"><div class="boxart-container"><img class="boxart-image" alt=""><div class="fallback-text-container" aria-hidden="true"><p class="fallback-text">${title}</p></div></div></a></div><div class="bob-container"></div></div></div>`;
    });

    it('resolves the anchor from the image and the fallback text', () => {
      expect(findCard(q('img.boxart-image'))).toBe(q('a[aria-label]'));
      expect(findCard(q('.fallback-text'))).toBe(q('a[aria-label]'));
    });

    it('reads the title and the id from the /watch/ href', () => {
      const card = q('a[aria-label]');
      expect([readTitle(card), readNetflixId(card)]).toEqual([title, '82942166']);
    });

    it('still finds no card from an episode card inside the container', () => {
      document.body.innerHTML = `<div data-uia="title-card-container"><a href="/watch/1?tctx=0" aria-label="Pilot" data-uia="episodic-card"><img class="ep" alt=""></a></div>`;
      expect(findCard(q('img.ep'))).toBeNull();
    });
  });

  it('finds the preview dialog from inside it and nothing from a card', () => {
    const dialog = q('[data-uia="modal-motion-container-MINI_MODAL"]');
    expect(findPreview(q('[data-uia="mini-modal-controls"] button'))).toBe(dialog);
    expect(findPreview(q('#bleach-img'))).toBeNull();
  });

  it('reads the preview id from the title link, then the play link', () => {
    const root = (links: string) =>
      `<div role="dialog" aria-modal="true" data-uia="modal-motion-container-MINI_MODAL" class="previewModal--container mini-modal">${links}</div>`;
    const title = '<a href="/title/70196252?dpRightClick=1&amp;trackId=1">Info</a>';
    const watch = '<a href="/watch/70196252?trackId=255824129" data-uia="play-button">Play</a>';

    document.body.innerHTML = root(watch + title);
    expect(readPreviewId(q('[role="dialog"]'))).toBe('70196252');
    document.body.innerHTML = root(watch);
    expect(readPreviewId(q('[role="dialog"]'))).toBe('70196252');
    document.body.innerHTML = root('<a href="/browse">Home</a>');
    expect(readPreviewId(q('[role="dialog"]'))).toBeUndefined();
  });

  it('returns the open preview only for the card it shows', () => {
    const dialog = q('[data-uia="modal-motion-container-MINI_MODAL"]');
    const bleach = q('[data-uia="progress-card"]');
    const frieren = q('[data-uia="standard-card"]');
    expect(findOpenPreview(document, bleach)).toBe(dialog);

    dialog.insertAdjacentHTML('beforeend', '<a href="/watch/70204957?trackId=1">Play</a>');
    expect(findOpenPreview(document, bleach)).toBe(dialog);
    expect(findOpenPreview(document, frieren)).toBeNull();
  });

  it('reads no year from show metadata without one', () => {
    expect(readYear(q('[data-uia="progress-card"]'))).toBeUndefined();
  });

  it('reads the year from the preview metadata', () => {
    renderPage('2023 HD');
    expect(readYear(q('[data-uia="progress-card"]'))).toBe(2023);
  });
});
