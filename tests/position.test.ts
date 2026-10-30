import { describe, expect, it } from 'vitest';
import { placePopover, type Rect } from '../src/content/popover/position';

const viewport = { width: 1280, height: 800 };
const popover = { width: 380, height: 600 };

function overlapsHorizontally(a: Rect, left: number, width: number): boolean {
  return left < a.left + a.width && left + width > a.left;
}

describe('placePopover', () => {
  it('goes right of the anchor with a 12 px gap when it fits', () => {
    const anchor = { left: 100, top: 100, width: 300, height: 170 };
    expect(placePopover(anchor, popover, viewport)).toEqual({ left: 412, top: 100 });
  });

  it('falls back to the left when the right side is too narrow', () => {
    const anchor = { left: 800, top: 100, width: 300, height: 170 };
    expect(placePopover(anchor, popover, viewport)).toEqual({ left: 408, top: 100 });
  });

  it('respects the 8 px margin when deciding whether a side fits', () => {
    const fitsExactly = { left: 450, top: 0, width: 1280 - 8 - 380 - 12 - 450, height: 100 };
    expect(placePopover(fitsExactly, popover, viewport).left).toBe(892);
    const tooWide = { ...fitsExactly, width: fitsExactly.width + 1 };
    expect(placePopover(tooWide, popover, viewport).left).toBe(450 - 12 - 380);
  });

  it('picks the roomier side when neither fits and never overlaps the anchor', () => {
    const wide = { left: 300, top: 50, width: 500, height: 400 };
    const small = { width: 1000, height: 800 };
    const left = placePopover(wide, popover, small).left;
    expect(left).toBe(300 - 12 - 380);
    expect(overlapsHorizontally(wide, left, popover.width)).toBe(false);

    const shifted = { ...wide, left: 100 };
    const right = placePopover(shifted, popover, small).left;
    expect(right).toBe(612);
    expect(overlapsHorizontally(shifted, right, popover.width)).toBe(false);
  });

  it('clamps vertically inside the viewport with an 8 px margin', () => {
    const low = { left: 100, top: 600, width: 300, height: 170 };
    expect(placePopover(low, popover, viewport).top).toBe(800 - 8 - 600);
    const high = { left: 100, top: -50, width: 300, height: 170 };
    expect(placePopover(high, popover, viewport).top).toBe(8);
  });

  it('pins to the top margin when the popover is taller than the viewport', () => {
    const anchor = { left: 100, top: 300, width: 300, height: 170 };
    expect(placePopover(anchor, { width: 380, height: 900 }, viewport).top).toBe(8);
  });
});
