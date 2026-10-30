import { h, type Child } from '../content/popover/dom';

export function section(cls: string, heading: string, description: string, ...children: Child[]): HTMLElement {
  return h(
    'section',
    { class: `card ${cls}` },
    h('div', { class: 'card-head' }, h('h2', null, heading), h('p', { class: 'desc' }, description)),
    ...children,
  );
}

export function button(text: string, variant: 'primary' | 'secondary' | 'danger', onclick?: () => void): HTMLButtonElement {
  return h('button', { type: 'button', class: `btn btn-${variant}`, onclick }, text);
}

export function statusLine(): HTMLSpanElement {
  return h('span', { class: 'status', role: 'status', 'aria-live': 'polite' });
}

export function setStatus(el: HTMLElement, text: string, isError = false): void {
  el.textContent = text;
  el.classList.toggle('error', isError);
}

export function actions(...children: Child[]): HTMLElement {
  return h('div', { class: 'actions' }, ...children);
}

export function link(url: string, text: string): HTMLAnchorElement {
  return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, text);
}

export interface TextField {
  wrap: HTMLElement;
  input: HTMLInputElement;
}

export function textField(
  id: string,
  label: string,
  opts: { type?: 'text' | 'password'; hint?: Child[]; placeholder?: string; inputmode?: string } = {},
): TextField {
  const input = h('input', {
    id,
    type: opts.type ?? 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: opts.placeholder,
    inputmode: opts.inputmode,
  });
  const wrap = h(
    'div',
    { class: 'field' },
    h('label', { for: id }, label),
    input,
    opts.hint && h('span', { class: 'hint' }, ...opts.hint),
  );
  return { wrap, input };
}
