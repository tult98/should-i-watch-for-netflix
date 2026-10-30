import { SETTINGS_KEY, parseSettings, themeOf, type Settings, type ThemePref } from '../shared/settings';
import { resolveTheme, type Theme } from '../shared/theme';
import type { StorageEvents } from './enabledSwitch';

export interface ColorSchemeQuery {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
}

// A change can land before the first load answers, and the load would then apply an older value.
export function watchTheme(
  events: StorageEvents,
  query: ColorSchemeQuery,
  load: () => Promise<Settings>,
  apply: (theme: Theme) => void,
): void {
  let pref: ThemePref = 'system';
  let changed = false;
  const push = () => apply(resolveTheme(pref, query.matches));
  events.addListener((changes, area) => {
    const change = changes[SETTINGS_KEY];
    if (area !== 'local' || !change) return;
    changed = true;
    pref = themeOf(parseSettings(change.newValue));
    push();
  });
  query.addEventListener('change', push);
  load().then(
    (settings) => {
      if (changed) return;
      pref = themeOf(settings);
      push();
    },
    () => !changed && push(),
  );
}
