import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/popup/popup.css', import.meta.url), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

const defined = (text: string) => new Set([...text.matchAll(/(--[\w-]+):/g)].map((m) => m[1]!));

describe('popup css custom properties', () => {
  const dark = defined(block(':root {'));
  const light = defined(block(":root[data-theme='light'] {"));
  const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]!));

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
