import { en } from './strings.en';
import { languageOf, type LanguagePref, type Settings } from './settings';
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

export function resolveLocale(pref: LanguagePref, uiLanguage?: string): Locale {
  return pref === 'auto' ? detectLocale(uiLanguage) : pref;
}

export let locale: Locale = detectLocale(browserUiLanguage());

export function setLocale(next: Locale): void {
  locale = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

export function initLocale(settings: Settings = {}): Locale {
  setLocale(resolveLocale(languageOf(settings), browserUiLanguage()));
  return locale;
}

// Modules capture sections such as `strings.options` at load, so every access must read the active dictionary.
function lazyView<T extends object>(read: () => T): T {
  return new Proxy({} as T, {
    get(_target, key) {
      const value = Reflect.get(read(), key);
      return typeof value === 'object' && value !== null ? lazyView(() => Reflect.get(read(), key) as object) : value;
    },
    has: (_target, key) => Reflect.has(read(), key),
    ownKeys: () => Reflect.ownKeys(read()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(read(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  });
}

export const strings: Strings = lazyView(() => STRINGS[locale]);
