import { describe, expect, it } from 'vitest';
import { POPOVER_CSS } from '../src/content/popover/styles';

function block(selector: string): string {
  const start = POPOVER_CSS.indexOf(selector);
  expect(start, selector).toBeGreaterThan(-1);
  return POPOVER_CSS.slice(start, POPOVER_CSS.indexOf('}', start));
}

const defined = (css: string) => new Set([...css.matchAll(/(--[\w-]+):/g)].map((m) => m[1]!));

describe('popover css custom properties', () => {
  const dark = defined(block('.panel {\n  --bg'));
  const light = defined(block('.panel[data-theme="light"] {\n  --bg'));
  const used = new Set([...POPOVER_CSS.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!).filter((n) => n !== '--cols'));

  it('defines every used property for dark', () => {
    expect([...used].filter((n) => !dark.has(n))).toEqual([]);
  });

  it('defines every used property for light', () => {
    expect([...used].filter((n) => !light.has(n))).toEqual([]);
  });

  it('keeps the light override to the same set as dark', () => {
    expect([...dark].sort()).toEqual([...light].sort());
  });
});
