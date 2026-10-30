import { sendLookup } from '../shared/messages';
import { quickVerdict } from '../shared/quickBadge';
import { loadSettings, thresholdsOf } from '../shared/settings';
import { describeResult } from './describeResult';
import { createHoverController, type HoverFire } from './hoverController';
import {
  findCard,
  findOpenPreview,
  findPreview,
  readNetflixId,
  readProfileLanguage,
  readTitle,
  readYear,
} from './netflixSelectors';
import { createPopoverHost } from './popover/host';
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
    return renderTitle(result.info, quickVerdict(result.info, thresholdsOf(settings)), new Date());
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

const host = createPopoverHost(window);
let anchoredCard: Element | null = null;

// The preview Netflix opens over the hovered card is the box the popover must not cover.
function present(card: Element, content: HTMLElement): void {
  if (host.visible() && anchoredCard === card) {
    host.swap(content);
    return;
  }
  anchoredCard = card;
  host.show(() => findOpenPreview(document) ?? card, content);
}

const controller = createHoverController<HTMLElement>({
  timers: {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  },
  reader: {
    findCard,
    findPreview,
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
