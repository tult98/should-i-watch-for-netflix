import { createHoverController } from './hoverController';
import { findCard, readProfileLanguage, readTitle, readYear } from './netflixSelectors';

const controller = createHoverController({
  timers: {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  },
  reader: {
    findCard,
    readTitle,
    readYear,
    readProfileLanguage: () => readProfileLanguage(document),
  },
  onFire: ({ title, year, lang }) => {
    console.log(`[hover] ${lang} ${title} ${year ?? '-'}`);
  },
});

controller.attach(document);
