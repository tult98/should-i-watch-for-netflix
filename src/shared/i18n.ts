import { en } from './strings.en';
import { vi, type Strings } from './strings.vi';

export type Locale = 'vi' | 'en';

export function detectLocale(uiLanguage?: string): Locale {
  if (uiLanguage === undefined) return 'vi';
  return uiLanguage.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function browserUiLanguage(): string | undefined {
  return typeof chrome === 'undefined' ? undefined : chrome.i18n?.getUILanguage();
}

const STRINGS: Record<Locale, Strings> = { vi, en };

export const locale: Locale = detectLocale(browserUiLanguage());
export const strings: Strings = STRINGS[locale];
