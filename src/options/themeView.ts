import { h } from '../content/popover/dom';
import { THEME_PREFS, themeOf, type Settings, type ThemePref } from '../shared/settings';
import { strings } from '../shared/strings.vi';
import { actions, section, setStatus, statusLine } from './ui';

const t = strings.options;

export interface ThemeView {
  element: HTMLElement;
  fill(settings: Settings): void;
}

export function renderThemeSection(save: (pref: ThemePref) => Promise<Settings>): ThemeView {
  const status = statusLine();
  const tabs = THEME_PREFS.map((pref) =>
    h(
      'button',
      { type: 'button', role: 'tab', class: 'tab', 'aria-selected': 'false', onclick: () => choose(pref) },
      t.themeLabels[pref],
    ),
  );

  function mark(pref: ThemePref): void {
    for (const [i, tab] of tabs.entries()) tab.setAttribute('aria-selected', String(THEME_PREFS[i] === pref));
  }

  function choose(pref: ThemePref): void {
    mark(pref);
    setStatus(status, t.saving);
    save(pref)
      .then((saved) => {
        mark(themeOf(saved));
        setStatus(status, t.saved);
      })
      .catch(() => setStatus(status, t.saveFailed, true));
  }

  mark('system');
  const element = section(
    'theme',
    t.themeHeading,
    t.themeDescription,
    h('div', { class: 'tabs', role: 'tablist' }, ...tabs),
    actions(status),
  );
  return { element, fill: (settings) => mark(themeOf(settings)) };
}
