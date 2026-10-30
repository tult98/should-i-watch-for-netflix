import { sendAiCached, sendAiOpinion, sendLookup, sendOpenOptions, sendRate, sendRatingGet } from '../shared/messages';
import { quickVerdict, type QuickBadge } from '../shared/quickBadge';
import type { Rating, TitleInfo } from '../shared/types';
import { loadSettings, thresholdsOf } from '../shared/settings';
import { describeResult } from './describeResult';
import { createHoverController, type HoverFire } from './hoverController';
import {
  findCard,
  findOpenPreview,
  findPreview,
  readNetflixId,
  readPreviewId,
  readProfileLanguage,
  readTitle,
  readYear,
} from './netflixSelectors';
import { createPopoverHost } from './popover/host';
import { applyAiError, applyAiResult, isAiLoading, setAiLoading } from './popover/ai';
import { applyRateClick, currentRating, setRating } from './popover/rating';
import { renderLoading, renderTitle } from './popover/render';

let detached = false;

function isInvalidated(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Extension context invalidated');
}

function handleInvalidated(): void {
  if (detached) return;
  detached = true;
  detach();
  console.log('[hover] extension was reloaded, refresh this tab');
}

function staleSuffix(requestId: number): string {
  return controller.isCurrent(requestId) ? '' : ' (stale)';
}

async function lookup({ title, year, lang, netflixId, requestId }: HoverFire): Promise<HTMLElement | null> {
  console.log(`[hover] ${lang} ${title} ${year ?? '-'} ${netflixId ?? '-'}`);
  if (!chrome.runtime?.id) {
    handleInvalidated();
    return null;
  }
  try {
    const [result, settings] = await Promise.all([sendLookup({ title, year, lang, netflixId }), loadSettings()]);
    console.log(`[lookup] ${title} -> ${describeResult(result)}${staleSuffix(requestId)}`);
    if (result.status !== 'match' || !controller.isCurrent(requestId)) return null;
    const { info } = result;
    const badge = quickVerdict(info, thresholdsOf(settings));
    const root: HTMLElement = renderTitle(info, badge, new Date(), {
      onAi: () => askAi(root, info, badge),
      onRate: (clicked) => rate(root, info, clicked),
    });
    // Read before showing so a cached opinion and the saved rating open with the popover instead of popping in after it.
    const [cached, rating] = await Promise.all([
      sendAiCached(info).catch(() => ({ status: 'none' }) as const),
      sendRatingGet(info.id, info.kind).catch(() => null),
    ]);
    if (cached.status === 'ok') applyAiResult(root, info, cached);
    if (rating) setRating(root, rating.rating);
    return root;
  } catch (err) {
    if (isInvalidated(err)) {
      handleInvalidated();
      return null;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[lookup] ${title} -> error ${message}${staleSuffix(requestId)}`);
    return null;
  }
}

function openSettings(): void {
  sendOpenOptions().catch((err: unknown) => {
    if (isInvalidated(err)) handleInvalidated();
  });
}

function rate(root: HTMLElement, info: TitleInfo, clicked: Rating): void {
  if (!chrome.runtime?.id) {
    handleInvalidated();
    return;
  }
  applyRateClick(root, clicked, (next) => sendRate(info, next))
    .then(() => console.log(`[popover] rated ${info.id} -> ${currentRating(root) ?? 'none'}`))
    .catch((err: unknown) => {
      if (isInvalidated(err)) handleInvalidated();
    });
}

// A popover root leaves the document when the popover hides or swaps, so a detached root means a stale answer.
function askAi(root: HTMLElement, info: TitleInfo, badge: QuickBadge): void {
  if (isAiLoading(root)) return;
  if (!chrome.runtime?.id) {
    handleInvalidated();
    return;
  }
  const release = controller.hold();
  setAiLoading(root, true);
  sendAiOpinion(info, badge)
    .then((response) => {
      const stale = root.isConnected ? '' : ' (stale)';
      const outcome = response.status === 'ok' ? `${response.opinion.verdict}${response.fromCache ? ' (cache)' : ''}` : `error ${response.reason}`;
      console.log(`[popover] ai ${info.id} -> ${outcome}${stale}`);
      if (!root.isConnected) return;
      if (response.status === 'ok') applyAiResult(root, info, response);
      else applyAiError(root, response.reason, openSettings);
    })
    .catch((err: unknown) => {
      if (isInvalidated(err)) {
        handleInvalidated();
        return;
      }
      if (root.isConnected) applyAiError(root, 'network', openSettings);
    })
    .finally(() => {
      if (root.isConnected && isAiLoading(root)) setAiLoading(root, false);
      release();
    });
}

const host = createPopoverHost(window);
let anchoredCard: Element | null = null;

// The preview Netflix opens over the hovered card is the box the popover must not cover.
function present(card: Element, content: HTMLElement): void {
  if (host.visible() && anchoredCard === card) {
    host.swap(content);
    return;
  }
  anchoredCard = card;
  host.show(() => findOpenPreview(document, card) ?? card, content);
}

const controller = createHoverController<HTMLElement>({
  timers: {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  },
  reader: {
    findCard,
    findPreview,
    readPreviewId,
    readTitle,
    readNetflixId,
    readYear,
    readProfileLanguage: () => readProfileLanguage(document),
  },
  lookup,
  view: {
    showLoading: (card) => present(card, renderLoading()),
    showContent: present,
    hide: () => {
      anchoredCard = null;
      host.hide();
    },
    contains: (target) => host.contains(target),
  },
});

const detach = controller.attach(document);
