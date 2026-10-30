/*
 * Every Netflix selector lives in this file. None of them has been verified
 * against the live site; Netflix ships obfuscated, changing markup.
 *
 * When hover logs stop appearing or show the wrong title, open DevTools on
 * netflix.com, inspect a card, and check:
 * - which ancestor of the hovered element wraps a single title (CARD_SELECTORS)
 * - where the title text lives: an aria-label on the link, a .fallback-text
 *   node, or an img alt (readTitle)
 * - where the expanded preview shows the release year (YEAR_SELECTORS)
 * - whether <html lang> still carries the profile language (readProfileLanguage)
 */

// Outermost wrapper first, so nested markup resolves one title to one element.
const CARD_SELECTORS = [
  '.slider-item',
  '[data-uia="title-card"]',
  '.title-card-container',
  '.title-card',
];

const PREVIEW_MODAL_SELECTOR = '.previewModal--wrapper';

const YEAR_SELECTORS = ['.year', '[data-uia="videoMetadata--year"]'];

export function findCard(target: Element): Element | null {
  for (const selector of CARD_SELECTORS) {
    const card = target.closest(selector);
    if (card) return card;
  }
  return null;
}

function clean(text: string | null | undefined): string | null {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

export function readTitle(card: Element): string | null {
  const link = card.matches('a[aria-label]') ? card : card.querySelector('a[aria-label]');
  return (
    clean(link?.getAttribute('aria-label')) ??
    clean(card.querySelector('.fallback-text')?.textContent) ??
    clean(card.querySelector('img[alt]')?.getAttribute('alt'))
  );
}

export function readYear(card: Element): number | undefined {
  const scope = card.ownerDocument.querySelector(PREVIEW_MODAL_SELECTOR) ?? card;
  for (const selector of YEAR_SELECTORS) {
    const match = scope.querySelector(selector)?.textContent?.match(/\b(19|20)\d{2}\b/);
    if (match) return Number(match[0]);
  }
  return undefined;
}

export function readProfileLanguage(doc: Document): string {
  return clean(doc.documentElement.lang) ?? 'en';
}
