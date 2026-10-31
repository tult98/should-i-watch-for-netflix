/*
 * Every Netflix selector lives in this file. They were verified against the
 * live site on 2026-10-30. Class names are generated hashes that change
 * between deploys, so only data-uia, aria-label and href are used.
 *
 * When hover logs stop appearing or show the wrong title, open DevTools on
 * netflix.com, inspect a card, and check:
 * - the card is still an <a> whose data-uia is one of CARD_UIA_VALUES, or, on
 *   New & Popular, an <a aria-label> inside data-uia "title-card-container"
 * - the anchor's aria-label still holds the title (readTitle)
 * - the href still carries the title id as /browse?jbv=<id>, /title/<id> or
 *   /watch/<id> (readNetflixId)
 * - the hover preview is still a dialog with data-uia
 *   "modal-motion-container-MINI_MODAL" and a "videoMetadata--container"
 *   inside (findPreview, findOpenPreview, readYear)
 * - the preview still links to /title/<id> or /watch/<id> (readPreviewId)
 * - whether <html lang> still carries the profile language (readProfileLanguage)
 *
 * Episode cards (data-uia "episodic-card") are never cards here: their
 * aria-label is the episode name, their jbv is the episode id, and nothing in
 * the card or preview names the show, so a lookup would match an unrelated title.
 */

const CARD_UIA_VALUES = ['progress-card', 'standard-card', 'ranked-card'];

const CARD_SELECTOR = [
  ...CARD_UIA_VALUES.map((uia) => `a[aria-label][data-uia="${uia}"]`),
  '[data-uia="title-card-container"] a[aria-label]:not([data-uia="episodic-card"])',
].join(', ');

const FALLBACK_CARD_SELECTOR = 'a[aria-label][data-uia$="-card"]:not([data-uia="episodic-card"])';

const PREVIEW_SELECTOR = '[data-uia="modal-motion-container-MINI_MODAL"]';

const PREVIEW_METADATA_SELECTOR = '[data-uia="videoMetadata--container"]';

export function findCard(target: Element): Element | null {
  return target.closest(CARD_SELECTOR) ?? target.closest(FALLBACK_CARD_SELECTOR);
}

export function findPreview(target: Element): Element | null {
  return target.closest(PREVIEW_SELECTOR);
}

// Returns the open preview only when it shows the card's title; a missing id on either side counts as a match.
export function findOpenPreview(doc: Document, card: Element): Element | null {
  const preview = doc.querySelector(PREVIEW_SELECTOR);
  if (!preview) return null;
  const previewId = readPreviewId(preview);
  const cardId = readNetflixId(card);
  return !previewId || !cardId || previewId === cardId ? preview : null;
}

export function readPreviewId(preview: Element): string | undefined {
  const link = preview.querySelector('a[href*="/title/"]') ?? preview.querySelector('a[href*="/watch/"]');
  return link?.getAttribute('href')?.match(/\/(?:title|watch)\/(\d+)/)?.[1];
}

function clean(text: string | null | undefined): string | null {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : null;
}

export function readTitle(card: Element): string | null {
  return clean(card.getAttribute('aria-label'));
}

export function readNetflixId(card: Element): string | undefined {
  const href = card.getAttribute('href');
  if (!href) return undefined;
  const url = new URL(href, 'https://www.netflix.com');
  const jbv = url.searchParams.get('jbv');
  if (jbv && /^\d+$/.test(jbv)) return jbv;
  return url.pathname.match(/\/(?:title|watch)\/(\d+)/)?.[1];
}

export function readYear(card: Element): number | undefined {
  const metadata = findOpenPreview(card.ownerDocument, card)?.querySelector(PREVIEW_METADATA_SELECTOR);
  const match = metadata?.textContent?.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

export function readProfileLanguage(doc: Document): string {
  return clean(doc.documentElement.lang) ?? 'en';
}
