// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createPopoverHost } from '../src/content/popover/host';

function content(text: string): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  return el;
}

describe('popover host', () => {
  afterEach(() => document.documentElement.querySelectorAll('div[style*="2147483647"]').forEach((n) => n.remove()));

  it('mounts a fixed host on the root element and reports its own targets', () => {
    const host = createPopoverHost(window);
    const card = document.createElement('a');
    document.body.appendChild(card);
    host.show(() => card, content('A'));

    const el = document.documentElement.lastElementChild as HTMLElement;
    expect(el.style.position).toBe('fixed');
    expect(el.style.zIndex).toBe('2147483647');
    expect(el.shadowRoot).toBeNull();
    expect(host.visible()).toBe(true);
    expect(host.contains(el)).toBe(true);
    expect(host.contains(card)).toBe(false);
  });

  it('swaps and hides without remounting', () => {
    const host = createPopoverHost(window);
    const card = document.createElement('a');
    document.body.appendChild(card);
    host.show(() => card, content('A'));
    host.swap(content('B'));
    host.show(() => card, content('C'));
    expect(document.querySelectorAll('div[style*="2147483647"]')).toHaveLength(1);

    host.hide();
    expect(host.visible()).toBe(false);
  });
});
