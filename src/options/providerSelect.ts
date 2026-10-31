import { h, icon } from '../content/popover/dom';
import { AI_PROVIDERS, AI_PROVIDER_IDS, apiFormatLabel, type AiProviderId } from '../shared/aiProviders';
import { PROVIDER_LOGOS } from '../shared/providerLogos';
import { providerName } from '../shared/providerName';

export interface ProviderSelect {
  element: HTMLElement;
  button: HTMLButtonElement;
  value(): AiProviderId;
  set(id: AiProviderId): void;
}

function badge(id: AiProviderId): HTMLElement {
  const preset = AI_PROVIDERS[id];
  const logo = PROVIDER_LOGOS[id];
  const mark = logo ? icon([logo], { size: 20, fill: 'currentColor' }) : providerName(id).charAt(0).toUpperCase();
  if (mark instanceof SVGElement) mark.setAttribute('fill-rule', 'evenodd');
  const el = h('span', { class: 'p-icon', 'aria-hidden': 'true' }, mark);
  el.style.background = preset.color;
  return el;
}

function body(id: AiProviderId): HTMLElement[] {
  return [
    badge(id),
    h('span', { class: 'p-text' }, h('span', { class: 'p-name' }, providerName(id)), h('span', { class: 'p-sub' }, apiFormatLabel(AI_PROVIDERS[id].format))),
  ];
}

// A native select cannot draw the icon square and the two-line rows, so this is a listbox button.
export function renderProviderSelect(id: string, labelledBy: string, onChange: (id: AiProviderId) => void): ProviderSelect {
  let current: AiProviderId = 'deepseek';
  let active = 0;
  const list = h('ul', { class: 'p-list', role: 'listbox', tabindex: '-1', 'aria-labelledby': labelledBy, hidden: '' });
  const options = AI_PROVIDER_IDS.map((pid, index) => {
    const option = h(
      'li',
      { class: 'p-option', role: 'option', id: `${id}-opt-${pid}`, 'aria-selected': 'false', 'data-provider': pid },
      ...body(pid),
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
  const element = h('div', { class: 'p-select' }, button, list);

  function paint(): void {
    shown.replaceChildren(...body(current));
    for (const [i, option] of options.entries()) option.setAttribute('aria-selected', String(AI_PROVIDER_IDS[i] === current));
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
    highlight(AI_PROVIDER_IDS.indexOf(current));
    list.focus();
  }

  function close(refocus: boolean): void {
    if (!isOpen()) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (refocus) button.focus();
  }

  function choose(index: number): void {
    const next = AI_PROVIDER_IDS[index]!;
    close(true);
    if (next === current) return;
    set(next);
    onChange(next);
  }

  function set(next: AiProviderId): void {
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
