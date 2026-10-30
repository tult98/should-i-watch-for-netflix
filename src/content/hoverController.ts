export const HOVER_DEBOUNCE_MS = 300;

export interface HoverFire {
  card: Element;
  title: string;
  year?: number;
  netflixId?: string;
  lang: string;
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

export type HoverState =
  | { name: 'idle' }
  | { name: 'armed'; card: Element; timer: unknown }
  | { name: 'loading'; card: Element };

export interface HoverControllerOptions {
  timers: Timers;
  reader: CardReader;
  onFire(fire: HoverFire): void;
  debounceMs?: number;
}

export interface HoverController {
  state(): HoverState;
  pointerOver(target: Element | null): void;
  pointerOut(target: Element | null, relatedTarget: Element | null): void;
  attach(doc: Document): () => void;
}

export function createHoverController(options: HoverControllerOptions): HoverController {
  const { timers, reader, onFire } = options;
  const debounceMs = options.debounceMs ?? HOVER_DEBOUNCE_MS;
  let state: HoverState = { name: 'idle' };

  function currentCard(): Element | null {
    return state.name === 'idle' ? null : state.card;
  }

  function toIdle(): void {
    if (state.name === 'armed') timers.clearTimeout(state.timer);
    state = { name: 'idle' };
  }

  function arm(card: Element): void {
    toIdle();
    const timer = timers.setTimeout(() => fire(card), debounceMs);
    state = { name: 'armed', card, timer };
  }

  function fire(card: Element): void {
    if (state.name !== 'armed' || state.card !== card) return;
    state = { name: 'loading', card };
    const title = reader.readTitle(card);
    if (!title) return;
    onFire({
      card,
      title,
      year: reader.readYear(card),
      netflixId: reader.readNetflixId(card),
      lang: reader.readProfileLanguage(),
    });
  }

  function pointerOver(target: Element | null): void {
    const card = target ? reader.findCard(target) : null;
    if (!card || card === currentCard()) return;
    arm(card);
  }

  // The preview opens in a separate layer, so it counts as part of whichever card is current.
  function belongsToCurrent(el: Element, card: Element): boolean {
    return reader.findCard(el) === card || reader.findPreview(el) !== null;
  }

  function pointerOut(target: Element | null, relatedTarget: Element | null): void {
    const card = currentCard();
    if (!card || !target || !belongsToCurrent(target, card)) return;
    // pointerout also fires when moving between children of the same card or preview.
    if (relatedTarget && belongsToCurrent(relatedTarget, card)) return;
    toIdle();
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

  return { state: () => state, pointerOver, pointerOut, attach };
}

function asElement(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : null;
}
