import { h } from '../content/popover/dom';
import { strings } from '../shared/strings.vi';
import type { KeyRow, PopupModel } from './model';

const t = strings.popup;

export interface PopupHandlers {
  toggle(enabled: boolean): Promise<void>;
  openSettings(): void;
  clearCache(): Promise<number>;
}

function setStatus(el: HTMLElement, text: string, isError = false): void {
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function switchRow(enabled: boolean, toggle: PopupHandlers['toggle']): HTMLElement {
  const state = h('span', { class: 'switch-state' });
  const status = h('span', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const control = h(
    'button',
    { type: 'button', role: 'switch', class: 'switch', 'aria-labelledby': 'switch-label' },
    h('span', { class: 'knob' }),
  );
  function show(on: boolean): void {
    control.setAttribute('aria-checked', String(on));
    state.textContent = on ? t.switchOn : t.switchOff;
  }
  control.addEventListener('click', () => {
    const next = control.getAttribute('aria-checked') !== 'true';
    show(next);
    setStatus(status, '');
    control.disabled = true;
    toggle(next)
      .catch(() => {
        show(!next);
        setStatus(status, t.switchFailed, true);
      })
      .finally(() => {
        control.disabled = false;
      });
  });
  show(enabled);
  return h(
    'section',
    { class: 'card switch-row' },
    h('div', { class: 'switch-text' }, h('span', { id: 'switch-label', class: 'switch-label' }, t.switchLabel), state, status),
    control,
  );
}

function keyRow({ key, label, set, status, note }: KeyRow): HTMLElement {
  return h(
    'li',
    { class: 'tile key-row', 'data-key': key },
    h('div', { class: 'key-text' }, h('span', { class: 'key-label' }, label), note && h('span', { class: 'key-note' }, note)),
    h('span', { class: `chip ${set ? 'chip-set' : 'chip-missing'}` }, h('span', { class: 'dot', 'aria-hidden': 'true' }), status),
  );
}

function actionsRow(handlers: PopupHandlers): HTMLElement {
  const status = h('span', { class: 'status', role: 'status', 'aria-live': 'polite' });
  const open = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => handlers.openSettings() }, t.openSettings);
  const clear = h('button', { type: 'button', class: 'btn btn-secondary' }, strings.options.clearCache);
  clear.addEventListener('click', () => {
    clear.disabled = true;
    setStatus(status, strings.options.clearingCache);
    handlers
      .clearCache()
      .then((count) => setStatus(status, strings.options.cacheCleared(count)))
      .catch(() => setStatus(status, strings.options.clearCacheFailed, true))
      .finally(() => {
        clear.disabled = false;
      });
  });
  return h('div', { class: 'actions' }, h('div', { class: 'buttons' }, open, clear), status);
}

export function renderPopup(model: PopupModel, handlers: PopupHandlers, name: string): HTMLElement {
  return h(
    'div',
    { class: 'popup' },
    h(
      'header',
      { class: 'head' },
      h('img', { src: 'icons/icon48.png', width: '32', height: '32', alt: '' }),
      h('h1', null, name),
    ),
    switchRow(model.enabled, handlers.toggle),
    h(
      'section',
      { class: 'card' },
      h('h2', null, t.keysHeading),
      h('ul', { class: 'keys' }, ...model.keys.map(keyRow)),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, t.ratingsHeading),
      h('p', { class: model.hasRatings ? 'ratings' : 'ratings ratings-empty' }, model.ratings),
    ),
    actionsRow(handlers),
  );
}
