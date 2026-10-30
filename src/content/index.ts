import { sendLookup } from '../shared/messages';
import { describeResult } from './describeResult';
import { createHoverController } from './hoverController';
import {
  findCard,
  findPreview,
  readNetflixId,
  readProfileLanguage,
  readTitle,
  readYear,
} from './netflixSelectors';

let requestId = 0;

function isCurrent(id: number, card: Element): boolean {
  const state = controller.state();
  return id === requestId && state.name !== 'idle' && state.card === card;
}

function staleSuffix(id: number, card: Element): string {
  return isCurrent(id, card) ? '' : ' (stale)';
}

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

const controller = createHoverController({
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
  onFire: ({ card, title, year, netflixId, lang }) => {
    console.log(`[hover] ${lang} ${title} ${year ?? '-'} ${netflixId ?? '-'}`);
    if (!chrome.runtime?.id) {
      handleInvalidated();
      return;
    }
    const id = ++requestId;
    sendLookup({ title, year, lang, netflixId }).then(
      (result) => {
        console.log(`[lookup] ${title} -> ${describeResult(result)}${staleSuffix(id, card)}`);
      },
      (err: unknown) => {
        if (isInvalidated(err)) {
          handleInvalidated();
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.log(`[lookup] ${title} -> error ${message}${staleSuffix(id, card)}`);
      },
    );
  },
});

const detach = controller.attach(document);
