import { locale, type Locale } from './i18n';
import type { TitleInfo } from './types';

// A synopsis in any language but the UI language needs the AI to write one.
export function needSummary(info: TitleInfo, uiLocale: Locale = locale): boolean {
  return !info.synopsis?.text.trim() || info.synopsis.lang !== uiLocale;
}
