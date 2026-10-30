import { placePopover, type Rect } from './position';
import type { Theme } from '../../shared/theme';
import { POPOVER_CSS } from './styles';

export type Anchor = () => Element | null;

export interface PopoverHost {
  show(anchor: Anchor, content: Node): void;
  swap(content: Node): void;
  hide(): void;
  contains(target: EventTarget | null): boolean;
  visible(): boolean;
  setTheme(theme: Theme): void;
}

const HOST_STYLE = 'position: fixed; left: 0; top: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';

function sameRect(a: Rect | null, b: Rect): boolean {
  return !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

export function createPopoverHost(win: Window = window): PopoverHost {
  const doc = win.document;
  const hostEl = doc.createElement('div');
  hostEl.setAttribute('style', HOST_STYLE);
  const root = hostEl.attachShadow({ mode: 'closed' });
  const style = doc.createElement('style');
  style.textContent = POPOVER_CSS;
  const panel = doc.createElement('div');
  panel.className = 'panel';
  panel.hidden = true;
  panel.dataset.theme = 'dark';
  root.append(style, panel);

  let anchor: Anchor | null = null;
  let frame: number | null = null;
  let lastAnchor: Rect | null = null;
  let lastPanel: Rect | null = null;

  // Netflix grows the card into its preview after the popover opens, and rows scroll,
  // so the anchor is re-read every frame while shown and the panel only moves on change.
  function reposition(): void {
    const el = anchor?.();
    if (!el || !el.isConnected) return;
    const a = el.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const anchorRect = { left: a.left, top: a.top, width: a.width, height: a.height };
    const panelRect = { left: 0, top: 0, width: p.width, height: p.height };
    if (sameRect(lastAnchor, anchorRect) && sameRect(lastPanel, panelRect)) return;
    lastAnchor = anchorRect;
    lastPanel = panelRect;
    const viewport = { width: doc.documentElement.clientWidth, height: win.innerHeight };
    const { left, top } = placePopover(anchorRect, panelRect, viewport);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function tick(): void {
    reposition();
    frame = win.requestAnimationFrame(tick);
  }

  function stop(): void {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
  }

  function swap(content: Node): void {
    panel.replaceChildren(content);
    lastPanel = null;
    reposition();
  }

  return {
    show(next, content) {
      if (!hostEl.isConnected) doc.documentElement.appendChild(hostEl);
      anchor = next;
      lastAnchor = null;
      panel.hidden = false;
      swap(content);
      if (frame === null) frame = win.requestAnimationFrame(tick);
    },
    swap,
    hide() {
      stop();
      anchor = null;
      panel.hidden = true;
      panel.replaceChildren();
    },
    contains: (target) => target instanceof Node && (target === hostEl || hostEl.contains(target)),
    visible: () => !panel.hidden,
    setTheme(theme) {
      panel.dataset.theme = theme;
    },
  };
}
