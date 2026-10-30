export const HOVER_DEBOUNCE_MS = 300;
export const HIDE_DELAY_MS = 150;
export const SKELETON_DELAY_MS = 150;

export interface HoverFire {
  card: Element;
  title: string;
  year?: number;
  netflixId?: string;
  lang: string;
  requestId: number;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface CardReader {
  findCard(target: Element): Element | null;
  findPreview(target: Element): Element | null;
  readTitle(card: Element): string | null;
  readNetflixId(card: Element): string | undefined;
  readYear(card: Element): number | undefined;
  readProfileLanguage(): string;
}

export interface PopoverView<T> {
  showLoading(card: Element): void;
  showContent(card: Element, content: T): void;
  hide(): void;
  contains(target: Element): boolean;
}

type LoadingState = { name: 'loading'; card: Element; requestId: number };
type ShownState = { name: 'shown'; card: Element; requestId: number };

export type HoverState =
  | { name: 'idle' }
  | { name: 'armed'; card: Element; timer: unknown }
  | LoadingState
  | ShownState
  // The lookup found nothing to show. The card stays current so moving inside it does not refire.
  | { name: 'empty'; card: Element; requestId: number };

export interface HoverControllerOptions<T> {
  timers: Timers;
  reader: CardReader;
  /** Resolves to the popover content, or null when there is nothing to show. */
  lookup(fire: HoverFire): Promise<T | null>;
  view: PopoverView<T>;
  debounceMs?: number;
  hideDelayMs?: number;
  skeletonDelayMs?: number;
}

export interface HoverController {
  state(): HoverState;
  isCurrent(requestId: number): boolean;
  pointerOver(target: Element | null): void;
  pointerOut(target: Element | null, relatedTarget: Element | null): void;
  attach(doc: Document): () => void;
}

export function createHoverController<T>(options: HoverControllerOptions<T>): HoverController {
  const { timers, reader, lookup, view } = options;
  const debounceMs = options.debounceMs ?? HOVER_DEBOUNCE_MS;
  const hideDelayMs = options.hideDelayMs ?? HIDE_DELAY_MS;
  const skeletonDelayMs = options.skeletonDelayMs ?? SKELETON_DELAY_MS;

  let state: HoverState = { name: 'idle' };
  let displayed: LoadingState | ShownState | null = null;
  let hideTimer: unknown = null;
  let skeletonTimer: unknown = null;
  let nextRequestId = 0;

  function currentCard(): Element | null {
    return state.name === 'idle' ? null : state.card;
  }

  function go(next: HoverState): void {
    if (state.name === 'armed') timers.clearTimeout(state.timer);
    if (skeletonTimer !== null) timers.clearTimeout(skeletonTimer);
    skeletonTimer = null;
    state = next;
  }

  function cancelHide(): void {
    if (hideTimer !== null) timers.clearTimeout(hideTimer);
    hideTimer = null;
  }

  function hidePopover(): void {
    if (!displayed) return;
    displayed = null;
    view.hide();
  }

  function toIdle(): void {
    cancelHide();
    go({ name: 'idle' });
    hidePopover();
  }

  function arm(card: Element): void {
    cancelHide();
    const timer = timers.setTimeout(() => fire(card), debounceMs);
    go({ name: 'armed', card, timer });
  }

  function fire(card: Element): void {
    if (state.name !== 'armed' || state.card !== card) return;
    const requestId = ++nextRequestId;
    const title = reader.readTitle(card);
    if (!title) {
      go({ name: 'empty', card, requestId });
      hidePopover();
      return;
    }
    const loading: LoadingState = { name: 'loading', card, requestId };
    go(loading);
    // A cached result answers well inside this delay, so it appears without a skeleton flash.
    skeletonTimer = timers.setTimeout(() => {
      skeletonTimer = null;
      if (state !== loading) return;
      displayed = loading;
      view.showLoading(card);
    }, skeletonDelayMs);
    const fireInfo: HoverFire = {
      card,
      title,
      year: reader.readYear(card),
      netflixId: reader.readNetflixId(card),
      lang: reader.readProfileLanguage(),
      requestId,
    };
    lookup(fireInfo).then(
      (content) => settle(loading, content),
      () => settle(loading, null),
    );
  }

  function settle(loading: LoadingState, content: T | null): void {
    if (state.name !== 'loading' || state.requestId !== loading.requestId) return;
    const { card, requestId } = loading;
    if (content === null) {
      go({ name: 'empty', card, requestId });
      hidePopover();
      return;
    }
    const shown: ShownState = { name: 'shown', card, requestId };
    go(shown);
    displayed = shown;
    view.showContent(card, content);
  }

  // Reaching the popover makes its card current again, even after crossing another card on the way.
  function enterPopover(): void {
    cancelHide();
    if (displayed && state !== displayed) go(displayed);
  }

  function pointerOver(target: Element | null): void {
    if (!target) return;
    if (displayed && view.contains(target)) {
      enterPopover();
      return;
    }
    const card = reader.findCard(target);
    if (card && card !== currentCard()) {
      arm(card);
      return;
    }
    if (card || (currentCard() && reader.findPreview(target))) cancelHide();
  }

  // The preview and the popover open in separate layers, so both count as part of the current card.
  function belongsToCurrent(el: Element, card: Element): boolean {
    return reader.findCard(el) === card || reader.findPreview(el) !== null || view.contains(el);
  }

  function pointerOut(target: Element | null, relatedTarget: Element | null): void {
    const card = currentCard();
    if (!card || !target || !belongsToCurrent(target, card)) return;
    // pointerout also fires when moving between children of the same card, preview or popover.
    if (relatedTarget && belongsToCurrent(relatedTarget, card)) return;
    if (!displayed) {
      toIdle();
      return;
    }
    if (hideTimer === null) hideTimer = timers.setTimeout(toIdle, hideDelayMs);
  }

  // Delegated on document because Netflix re-renders rows and would drop per-card listeners.
  function attach(doc: Document): () => void {
    const over = (e: PointerEvent) => pointerOver(asElement(e.target));
    const out = (e: PointerEvent) => pointerOut(asElement(e.target), asElement(e.relatedTarget));
    doc.addEventListener('pointerover', over, true);
    doc.addEventListener('pointerout', out, true);
    return () => {
      doc.removeEventListener('pointerover', over, true);
      doc.removeEventListener('pointerout', out, true);
      toIdle();
    };
  }

  return {
    state: () => state,
    isCurrent: (requestId) => state.name === 'loading' && state.requestId === requestId,
    pointerOver,
    pointerOut,
    attach,
  };
}

function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}
