import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHoverController, type HoverFire } from '../src/content/hoverController';

interface FakeNode {
  card: FakeNode | null;
  title: string;
}

function makeCard(title: string): { card: Element; child: Element } {
  const card: FakeNode = { card: null, title };
  card.card = card;
  const child: FakeNode = { card, title };
  return { card: card as unknown as Element, child: child as unknown as Element };
}

const outside = { card: null, title: '' } as unknown as Element;

function setup() {
  const fires: HoverFire[] = [];
  const controller = createHoverController({
    timers: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as number) },
    reader: {
      findCard: (el) => (el as unknown as FakeNode).card as unknown as Element | null,
      readTitle: (card) => (card as unknown as FakeNode).title,
      readYear: () => 2023,
      readProfileLanguage: () => 'en',
    },
    onFire: (f) => fires.push(f),
  });
  return { controller, fires };
}

function enter(controller: ReturnType<typeof setup>['controller'], from: Element, to: Element) {
  controller.pointerOut(from, to);
  controller.pointerOver(to);
}

describe('hoverController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once after 300 ms on a card', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    enter(controller, outside, a.child);

    vi.advanceTimersByTime(299);
    expect(fires).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(fires).toEqual([{ card: a.card, title: 'Frieren', year: 2023, lang: 'en' }]);

    enter(controller, a.child, a.card);
    vi.advanceTimersByTime(1000);
    expect(fires).toHaveLength(1);
  });

  it('fires only for the last card when sweeping across five cards within 300 ms', () => {
    const { controller, fires } = setup();
    const cards = ['A', 'B', 'C', 'D', 'E'].map(makeCard);
    let prev = outside;
    for (const c of cards) {
      enter(controller, prev, c.child);
      prev = c.child;
      vi.advanceTimersByTime(50);
    }

    vi.advanceTimersByTime(1000);
    expect(fires.map((f) => f.title)).toEqual(['E']);
  });

  it('fires nothing when the pointer leaves before 300 ms', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(200);
    controller.pointerOut(a.child, outside);

    vi.advanceTimersByTime(1000);
    expect(fires).toHaveLength(0);
    expect(controller.state().name).toBe('idle');
  });

  it('fires again when re-entering the same card after leaving it', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(300);
    controller.pointerOut(a.child, null);
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(300);

    expect(fires.map((f) => f.title)).toEqual(['Frieren', 'Frieren']);
  });
});
