import { h } from '../content/popover/dom';
import { strings } from '../shared/i18n';
import type { ThresholdSet } from '../shared/types';
import {
  rowLabel,
  thresholdFormValues,
  thresholdRows,
  type FieldError,
  type FieldKey,
  type FormValues,
  type RowKey,
  type SetKey,
} from './thresholds';
import { actions, button, section, setStatus, statusLine } from './ui';

const t = strings.options;

const BADGE_CLASS: Record<RowKey, string> = {
  highly: 'tbadge tbadge-highly',
  recommended: 'tbadge tbadge-recommended',
  maybe: 'tbadge tbadge-maybe',
  warn: 'tbadge tbadge-warn',
};

export interface ThresholdView {
  element: HTMLElement;
  fill(set: ThresholdSet): void;
  read(): FormValues;
  showErrors(errors: FieldError[]): void;
  status: HTMLSpanElement;
}

export function renderThresholdSection(
  set: SetKey,
  handlers: { onSave: (view: ThresholdView) => void; onReset: (view: ThresholdView) => void },
): ThresholdView {
  const inputs = new Map<FieldKey, HTMLInputElement>();
  const errorBox = h('div', { class: 'field-errors', role: 'alert', id: `th-${set}-errors` });
  const status = statusLine();

  const rows = thresholdRows(set).map(({ row, fields }) =>
    h(
      'div',
      { class: 'trow' },
      h('span', { class: BADGE_CLASS[row] }, rowLabel(row)),
      ...fields.map((field) => {
        const id = `th-${set}-${field.key}`;
        const input = h('input', {
          id,
          type: 'text',
          class: field.kind === 'score' ? 'num num-score' : field.key === 'rankMax' ? 'num num-rank' : 'num num-count',
          inputmode: field.kind === 'score' ? 'decimal' : 'numeric',
          autocomplete: 'off',
          'aria-describedby': errorBox.id,
        });
        inputs.set(field.key, input);
        return h('div', { class: 'tfield' }, h('label', { for: id }, field.label), input);
      }),
      row === 'warn' && h('span', { class: 'tnote' }, t.warnNote),
    ),
  );

  function showErrors(errors: FieldError[]): void {
    const bad = new Set(errors.map((e) => e.key));
    for (const [key, input] of inputs) {
      if (bad.has(key)) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    errorBox.replaceChildren(...errors.map((e) => h('p', null, e.message)));
  }

  const view: ThresholdView = {
    element: section(
      `thresholds thresholds-${set}`,
      t.thresholdHeading(t.thresholdSet[set]),
      t.thresholdDescription[set],
      h('div', { class: 'trows' }, ...rows),
      set === 'mal' && h('span', { class: 'hint' }, t.rankHint),
      errorBox,
      actions(
        button(t.saveThresholds, 'primary', () => handlers.onSave(view)),
        button(t.resetThresholds, 'secondary', () => handlers.onReset(view)),
        status,
      ),
    ),
    status,
    fill(value) {
      const values = thresholdFormValues(value);
      for (const [key, input] of inputs) input.value = values[key] ?? '';
      showErrors([]);
    },
    read() {
      const values: FormValues = {};
      for (const [key, input] of inputs) values[key] = input.value;
      return values;
    },
    showErrors,
  };
  for (const input of inputs.values()) input.addEventListener('input', () => setStatus(status, ''));
  return view;
}
