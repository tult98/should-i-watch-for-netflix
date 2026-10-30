import { describe, expect, it, vi } from 'vitest';
import { detectLocale } from '../src/shared/i18n';
import { en } from '../src/shared/strings.en';
import { vi as viStrings } from '../src/shared/strings.vi';

function shape(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)]));
  }
  return typeof value;
}

describe('detectLocale', () => {
  it('picks Vietnamese for vi and vi-VN', () => {
    expect(detectLocale('vi')).toBe('vi');
    expect(detectLocale('vi-VN')).toBe('vi');
  });

  it('picks English for every other language', () => {
    expect(detectLocale('en-US')).toBe('en');
    expect(detectLocale('de')).toBe('en');
    expect(detectLocale('')).toBe('en');
  });

  it('defaults to Vietnamese when the browser gives no language', () => {
    expect(detectLocale(undefined)).toBe('vi');
  });
});

describe('locale at load', () => {
  async function loadWith(chromeStub: unknown) {
    vi.resetModules();
    vi.stubGlobal('chrome', chromeStub);
    const mod = await import('../src/shared/i18n');
    vi.unstubAllGlobals();
    return mod;
  }

  it('reads chrome.i18n.getUILanguage', async () => {
    const mod = await loadWith({ i18n: { getUILanguage: () => 'en-GB' } });
    expect(mod.locale).toBe('en');
    expect(mod.strings.popup.keySet).toBe(en.popup.keySet);
  });

  it('falls back to Vietnamese without chrome.i18n', async () => {
    const mod = await loadWith({});
    expect(mod.locale).toBe('vi');
    expect(mod.strings.popup.keySet).toBe(viStrings.popup.keySet);
  });
});

describe('strings', () => {
  it('has the same key tree and value types in vi and en', () => {
    expect(shape(en)).toEqual(shape(viStrings));
  });
});
