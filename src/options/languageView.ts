import { h } from '../content/popover/dom';
import { LANGUAGE_PREFS, languageOf, type LanguagePref, type Settings } from '../shared/settings';
import { strings } from '../shared/i18n';
import { actions, section, setStatus, statusLine } from './ui';

const t = strings.options;

export interface LanguageView {
  element: HTMLElement;
  fill(settings: Settings): void;
}

export function renderLanguageSection(save: (pref: LanguagePref) => Promise<Settings>): LanguageView {
  const status = statusLine();
  const tabs = LANGUAGE_PREFS.map((pref) =>
    h(
      'button',
      { type: 'button', role: 'tab', class: 'tab', 'aria-selected': 'false', onclick: () => choose(pref) },
      t.languageLabels[pref],
    ),
  );

  function mark(pref: LanguagePref): void {
    for (const [i, tab] of tabs.entries()) tab.setAttribute('aria-selected', String(LANGUAGE_PREFS[i] === pref));
  }

  function choose(pref: LanguagePref): void {
    mark(pref);
    setStatus(status, t.saving);
    save(pref)
      .then((saved) => {
        mark(languageOf(saved));
        setStatus(status, t.saved);
      })
      .catch(() => setStatus(status, t.saveFailed, true));
  }

  mark('auto');
  const element = section(
    'language',
    t.languageHeading,
    t.languageDescription,
    h('div', { class: 'tabs', role: 'tablist' }, ...tabs),
    actions(status),
  );
  return { element, fill: (settings) => mark(languageOf(settings)) };
}
