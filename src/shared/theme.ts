import type { ThemePref } from './settings';

export type Theme = 'dark' | 'light';

export function resolveTheme(pref: ThemePref, systemPrefersLight: boolean): Theme {
  return pref === 'system' ? (systemPrefersLight ? 'light' : 'dark') : pref;
}
