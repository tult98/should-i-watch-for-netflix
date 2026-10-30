export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export const POPOVER_GAP = 12;
export const VIEWPORT_MARGIN = 8;

export function placePopover(anchor: Rect, popover: Size, viewport: Size): { left: number; top: number } {
  const anchorRight = anchor.left + anchor.width;
  const rightLeft = anchorRight + POPOVER_GAP;
  const leftLeft = anchor.left - POPOVER_GAP - popover.width;
  const fitsRight = rightLeft + popover.width <= viewport.width - VIEWPORT_MARGIN;
  const fitsLeft = leftLeft >= VIEWPORT_MARGIN;
  let left: number;
  if (fitsRight) left = rightLeft;
  else if (fitsLeft) left = leftLeft;
  else left = viewport.width - anchorRight >= anchor.left ? rightLeft : leftLeft;

  const maxTop = viewport.height - VIEWPORT_MARGIN - popover.height;
  const top = Math.max(VIEWPORT_MARGIN, Math.min(anchor.top, maxTop));
  return { left, top };
}
