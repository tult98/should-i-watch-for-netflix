import { sendLookup } from '../shared/messages';
import type { LookupResult } from '../shared/types';
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

function describe(result: LookupResult): string {
  switch (result.status) {
    case 'match': {
      const { matchedName, confidence } = result.info.match;
      return `${matchedName} ${Math.round(confidence * 100)}% ${result.info.id}`;
    }
    case 'no_match':
      return 'no_match';
    case 'error':
      return `error ${result.reason}`;
  }
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
        console.log(`[lookup] ${title} -> ${describe(result)}${staleSuffix(id, card)}`);
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
