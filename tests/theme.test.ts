import { describe, expect, it } from 'vitest';
import { watchTheme, type ColorSchemeQuery } from '../src/content/themeWatcher';
import type { Settings } from '../src/shared/settings';
import { resolveTheme, type Theme } from '../src/shared/theme';

describe('resolveTheme', () => {
  it('follows the system only for the system pref', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
  });
});

function setup(load: () => Promise<Settings>, prefersLight = false) {
  let onStorage: ((changes: Record<string, { newValue?: unknown }>, area: string) => void) | undefined;
  let onMedia: (() => void) | undefined;
  const query = {
    matches: prefersLight,
    addEventListener: (_: 'change', listener: () => void) => void (onMedia = listener),
  } satisfies ColorSchemeQuery;
  const applied: Theme[] = [];
  watchTheme({ addListener: (l) => void (onStorage = l) }, query, load, (t) => applied.push(t));
  return {
    applied,
    store: (value: unknown, area = 'local') => onStorage!({ settings: { newValue: value } }, area),
    media: (matches: boolean) => {
      query.matches = matches;
      onMedia!();
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('watchTheme', () => {
  it('applies the stored pref on load, resolving system through the media query', async () => {
    const light = setup(async () => ({ theme: 'light' }));
    await flush();
    expect(light.applied).toEqual(['light']);
    const system = setup(async () => ({}), true);
    await flush();
    expect(system.applied).toEqual(['light']);
  });

  it('applies dark when the load fails', async () => {
    const w = setup(() => Promise.reject(new Error('x')));
    await flush();
    expect(w.applied).toEqual(['dark']);
  });

  it('lets a storage change that lands before the load win over the load', async () => {
    let resolve!: (s: Settings) => void;
    const w = setup(() => new Promise((r) => (resolve = r)));
    w.store({ theme: 'light' });
    resolve({ theme: 'dark' });
    await flush();
    expect(w.applied).toEqual(['light']);
  });

  it('follows later storage changes and ignores other areas and keys', async () => {
    const w = setup(async () => ({ theme: 'dark' }));
    await flush();
    w.store({ theme: 'light' });
    w.store({ theme: 'dark' }, 'sync');
    expect(w.applied).toEqual(['dark', 'light']);
  });

  it('re-resolves on a media change only while the pref is system', async () => {
    const system = setup(async () => ({ theme: 'system' }));
    await flush();
    system.media(true);
    system.media(false);
    expect(system.applied).toEqual(['dark', 'light', 'dark']);
    const fixed = setup(async () => ({ theme: 'dark' }));
    await flush();
    fixed.media(true);
    expect(fixed.applied).toEqual(['dark', 'dark']);
  });
});
