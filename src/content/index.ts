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
    const id = ++requestId;
    sendLookup({ title, year, lang, netflixId }).then(
      (result) => {
        if (!isCurrent(id, card)) return;
        console.log(`[lookup] ${title} -> ${describe(result)}`);
      },
      (err: unknown) => {
        if (!isCurrent(id, card)) return;
        console.log(`[lookup] ${title} -> error ${err instanceof Error ? err.message : String(err)}`);
      },
    );
  },
});

controller.attach(document);
