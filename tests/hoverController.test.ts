import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHoverController, type HoverFire } from '../src/content/hoverController';

interface FakeNode {
  card: FakeNode | null;
  title: string;
  preview?: boolean;
  popover?: boolean;
}

function makeCard(title: string): { card: Element; child: Element } {
  const card: FakeNode = { card: null, title };
  card.card = card;
  const child: FakeNode = { card, title };
  return { card: card as unknown as Element, child: child as unknown as Element };
}

const outside = { card: null, title: '' } as unknown as Element;
const preview = { card: null, title: '', preview: true } as unknown as Element;
const previewButton = { card: null, title: '', preview: true } as unknown as Element;
const popover = { card: null, title: '', popover: true } as unknown as Element;

interface Pending {
  fire: HoverFire;
  resolve(content: string | null): void;
}

function setup() {
  const fires: HoverFire[] = [];
  const pending: Pending[] = [];
  const calls: string[] = [];
  const title = (el: Element) => (el as unknown as FakeNode).title;
  const controller = createHoverController<string>({
    timers: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as number) },
    reader: {
      findCard: (el) => (el as unknown as FakeNode).card as unknown as Element | null,
      findPreview: (el) => ((el as unknown as FakeNode).preview ? el : null),
      readTitle: (card) => title(card),
      readNetflixId: (card) => `id-${title(card)}`,
      readYear: () => 2023,
      readProfileLanguage: () => 'en',
    },
    lookup: (fire) => {
      fires.push(fire);
      return new Promise((resolve) => pending.push({ fire, resolve }));
    },
    view: {
      showLoading: (card) => calls.push(`loading ${title(card)}`),
      showContent: (card, content) => calls.push(`show ${title(card)} ${content}`),
      hide: () => calls.push('hide'),
      contains: (el) => (el as unknown as FakeNode).popover === true,
    },
  });
  async function answer(index: number, content: string | null) {
    pending[index]!.resolve(content);
    await vi.advanceTimersByTimeAsync(0);
  }
  return { controller, fires, calls, answer };
}

type Controller = ReturnType<typeof setup>['controller'];

function enter(controller: Controller, from: Element, to: Element) {
  controller.pointerOut(from, to);
  controller.pointerOver(to);
}

describe('hoverController arming', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once after 300 ms on a card', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    enter(controller, outside, a.child);

    vi.advanceTimersByTime(299);
    expect(fires).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(fires).toEqual([
      { card: a.card, title: 'Frieren', year: 2023, netflixId: 'id-Frieren', lang: 'en', requestId: 1 },
    ]);

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

  it('still fires when the pointer moves from the card into the preview before 300 ms', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(100);
    enter(controller, a.child, preview);
    enter(controller, preview, previewButton);

    vi.advanceTimersByTime(200);
    expect(fires.map((f) => f.title)).toEqual(['Frieren']);
    expect(controller.state().name).toBe('loading');
  });

  it('cancels when the pointer leaves the preview to outside', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    enter(controller, outside, a.child);
    enter(controller, a.child, preview);
    vi.advanceTimersByTime(100);
    enter(controller, preview, outside);

    vi.advanceTimersByTime(1000);
    expect(fires).toHaveLength(0);
    expect(controller.state().name).toBe('idle');
  });

  it('does not refire when the pointer returns from the preview to the same card', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(300);
    enter(controller, a.child, preview);
    enter(controller, preview, a.child);

    vi.advanceTimersByTime(1000);
    expect(fires).toHaveLength(1);
    expect(controller.state()).toMatchObject({ name: 'loading', card: a.card });
  });

  it('arms the other card when the pointer leaves the preview onto it', () => {
    const { controller, fires } = setup();
    const a = makeCard('Frieren');
    const b = makeCard('Bleach');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(300);
    enter(controller, a.child, preview);
    enter(controller, preview, b.child);
    expect(controller.state()).toMatchObject({ name: 'armed', card: b.card });

    vi.advanceTimersByTime(300);
    expect(fires.map((f) => f.title)).toEqual(['Frieren', 'Bleach']);
  });

  it('ignores the preview when no card is current', () => {
    const { controller, fires } = setup();
    enter(controller, outside, preview);
    enter(controller, preview, outside);

    vi.advanceTimersByTime(1000);
    expect(fires).toHaveLength(0);
    expect(controller.state().name).toBe('idle');
  });
});

describe('hoverController popover', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function showA() {
    const s = setup();
    const a = makeCard('A');
    enter(s.controller, outside, a.child);
    vi.advanceTimersByTime(300);
    await s.answer(0, 'info-A');
    return { ...s, a };
  }

  it('shows a fast answer directly, with no skeleton', async () => {
    const { controller, calls, a } = await showA();
    expect(calls).toEqual(['show A info-A']);
    expect(controller.state()).toMatchObject({ name: 'shown', card: a.card, requestId: 1 });
  });

  it('shows the skeleton only once the answer takes 150 ms, then swaps in the content', async () => {
    const { controller, calls, answer } = setup();
    const a = makeCard('A');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(300 + 149);
    expect(calls).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['loading A']);

    await answer(0, 'info-A');
    expect(calls).toEqual(['loading A', 'show A info-A']);
  });

  it('keeps the popover while the pointer moves from the card onto the popover', async () => {
    const { controller, calls, a } = await showA();
    controller.pointerOut(a.child, outside);
    vi.advanceTimersByTime(100);
    enter(controller, outside, popover);

    vi.advanceTimersByTime(1000);
    expect(calls).toEqual(['show A info-A']);
    expect(controller.state().name).toBe('shown');
  });

  it('keeps it across card, preview and popover, then hides 150 ms after leaving all three', async () => {
    const { controller, calls, a } = await showA();
    enter(controller, a.child, preview);
    enter(controller, preview, popover);
    vi.advanceTimersByTime(1000);
    expect(controller.state().name).toBe('shown');

    controller.pointerOut(popover, outside);
    vi.advanceTimersByTime(149);
    expect(calls).toEqual(['show A info-A']);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['show A info-A', 'hide']);
    expect(controller.state().name).toBe('idle');
  });

  it('stays up while held, then hides 150 ms after release when the pointer is still away', async () => {
    const { controller, calls } = await showA();
    enter(controller, outside, popover);
    const release = controller.hold();
    controller.pointerOut(popover, outside);
    vi.advanceTimersByTime(5_000);
    expect(calls).toEqual(['show A info-A']);
    expect(controller.state().name).toBe('shown');

    release();
    vi.advanceTimersByTime(149);
    expect(calls).toEqual(['show A info-A']);
    vi.advanceTimersByTime(1);
    expect(calls).toEqual(['show A info-A', 'hide']);
  });

  it('does not hide on release when the pointer came back while held', async () => {
    const { controller, calls } = await showA();
    enter(controller, outside, popover);
    const release = controller.hold();
    controller.pointerOut(popover, outside);
    vi.advanceTimersByTime(1_000);
    enter(controller, outside, popover);
    release();
    vi.advanceTimersByTime(1_000);
    expect(calls).toEqual(['show A info-A']);
  });

  it('cancels the hide when the pointer comes back to the card', async () => {
    const { controller, calls, a } = await showA();
    enter(controller, a.child, outside);
    vi.advanceTimersByTime(100);
    enter(controller, outside, a.child);

    vi.advanceTimersByTime(1000);
    expect(calls).toEqual(['show A info-A']);
  });

  it('swaps content for another card without hiding first', async () => {
    const { controller, calls, answer, a } = await showA();
    const b = makeCard('B');
    enter(controller, a.child, b.child);
    vi.advanceTimersByTime(300);
    await answer(1, 'info-B');

    expect(calls).toEqual(['show A info-A', 'show B info-B']);
    expect(controller.state()).toMatchObject({ name: 'shown', card: b.card });
  });

  it('swaps to the skeleton when the other card answers slowly', async () => {
    const { controller, calls, a } = await showA();
    const b = makeCard('B');
    enter(controller, a.child, b.child);
    vi.advanceTimersByTime(300 + 150);

    expect(calls).toEqual(['show A info-A', 'loading B']);
  });

  it('never renders a stale answer', async () => {
    const { controller, calls, answer } = setup();
    const a = makeCard('A');
    const b = makeCard('B');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(300);
    enter(controller, a.child, b.child);
    vi.advanceTimersByTime(300);
    expect(controller.isCurrent(1)).toBe(false);
    expect(controller.isCurrent(2)).toBe(true);

    await answer(0, 'info-A');
    expect(calls).toEqual([]);
    await answer(1, 'info-B');
    expect(calls).toEqual(['show B info-B']);
  });

  it('hides on no match and does not refire while the pointer stays on the card', async () => {
    const { controller, calls, answer, fires } = setup();
    const a = makeCard('A');
    enter(controller, outside, a.child);
    vi.advanceTimersByTime(300 + 150);
    await answer(0, null);

    expect(calls).toEqual(['loading A', 'hide']);
    enter(controller, a.child, a.card);
    vi.advanceTimersByTime(1000);
    expect(fires).toHaveLength(1);

    controller.pointerOut(a.card, outside);
    expect(controller.state().name).toBe('idle');
  });

  it('returns to the shown card when the pointer crosses another card on the way to the popover', async () => {
    const { controller, calls, fires, a } = await showA();
    const b = makeCard('B');
    enter(controller, a.child, b.child);
    vi.advanceTimersByTime(100);
    enter(controller, b.child, popover);

    vi.advanceTimersByTime(1000);
    expect(fires.map((f) => f.title)).toEqual(['A']);
    expect(controller.state()).toMatchObject({ name: 'shown', card: a.card });
    expect(calls).toEqual(['show A info-A']);
  });

  it('hides when the pointer leaves another armed card while the popover is up', async () => {
    const { controller, calls, a } = await showA();
    const b = makeCard('B');
    enter(controller, a.child, b.child);
    enter(controller, b.child, outside);
    vi.advanceTimersByTime(150);

    expect(calls).toEqual(['show A info-A', 'hide']);
    expect(controller.state().name).toBe('idle');
  });
});
