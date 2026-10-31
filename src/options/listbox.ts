import { h, icon } from '../content/popover/dom';

export interface ListboxItem<T extends string> {
  value: T;
  content: () => HTMLElement[];
}

export interface ListboxOptions<T extends string> {
  id: string;
  labelledBy: string;
  items: readonly ListboxItem<T>[];
  initial: T;
  optionAttr: string;
  compact?: boolean;
  onChange: (value: T) => void;
}

export interface Listbox<T extends string> {
  element: HTMLElement;
  button: HTMLButtonElement;
  value(): T;
  set(value: T): void;
}

// A native select cannot draw custom rows or follow the page theme, so this is a listbox button.
export function renderListbox<T extends string>({
  id,
  labelledBy,
  items,
  initial,
  optionAttr,
  compact = false,
  onChange,
}: ListboxOptions<T>): Listbox<T> {
  let current = initial;
  let active = 0;
  const list = h('ul', { class: 'p-list', role: 'listbox', tabindex: '-1', 'aria-labelledby': labelledBy, hidden: '' });
  const options = items.map((item, index) => {
    const option = h(
      'li',
      { class: 'p-option', role: 'option', id: `${id}-opt-${item.value}`, 'aria-selected': 'false', [optionAttr]: item.value },
      ...item.content(),
    );
    option.addEventListener('click', () => choose(index));
    option.addEventListener('mousemove', () => highlight(index));
    list.appendChild(option);
    return option;
  });
  const shown = h('span', { class: 'p-current' });
  const button = h(
    'button',
    { type: 'button', id, class: 'p-button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-labelledby': `${labelledBy} ${id}` },
    shown,
    icon(['M6 9l6 6 6-6'], { size: 18, stroke: 'currentColor' }),
  );
  const element = h('div', { class: compact ? 'p-select p-compact' : 'p-select' }, button, list);

  function indexOf(value: T): number {
    return items.findIndex((item) => item.value === value);
  }

  function paint(): void {
    shown.replaceChildren(...items[indexOf(current)]!.content());
    for (const [i, option] of options.entries()) option.setAttribute('aria-selected', String(items[i]!.value === current));
  }

  function highlight(index: number): void {
    active = (index + options.length) % options.length;
    for (const [i, option] of options.entries()) option.classList.toggle('active', i === active);
    list.setAttribute('aria-activedescendant', options[active]!.id);
    options[active]!.scrollIntoView?.({ block: 'nearest' });
  }

  function isOpen(): boolean {
    return !list.hidden;
  }

  function open(): void {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    highlight(indexOf(current));
    list.focus();
  }

  function close(refocus: boolean): void {
    if (!isOpen()) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  }

  function choose(index: number): void {
    const next = items[index]!.value;
    close(true);
    if (next === current) return;
    set(next);
    onChange(next);
  }

  function set(next: T): void {
    current = next;
    paint();
  }

  button.addEventListener('click', () => (isOpen() ? close(true) : open()));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  list.addEventListener('keydown', (event) => {
    const moves: Record<string, () => void> = {
      ArrowDown: () => highlight(active + 1),
      ArrowUp: () => highlight(active - 1),
      Home: () => highlight(0),
      End: () => highlight(options.length - 1),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => close(true),
      Tab: () => close(false),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  });
  document.addEventListener('click', (event) => {
    if (!element.contains(event.target as Node)) close(false);
  });

  paint();
  return { element, button, value: () => current, set };
}
