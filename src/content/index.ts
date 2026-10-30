import { createHoverController } from './hoverController';
import {
  findCard,
  findPreview,
  readNetflixId,
  readProfileLanguage,
  readTitle,
  readYear,
} from './netflixSelectors';

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
  onFire: ({ title, year, netflixId, lang }) => {
    console.log(`[hover] ${lang} ${title} ${year ?? '-'} ${netflixId ?? '-'}`);
  },
});

controller.attach(document);
