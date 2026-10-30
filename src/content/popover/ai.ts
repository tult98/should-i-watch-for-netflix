import type { AiOk } from '../../shared/messages';
import { needSummary } from '../../shared/needSummary';
import { strings } from '../../shared/strings.vi';
import type { AIErrorReason, TitleInfo } from '../../shared/types';
import { h, icon } from './dom';
import { kindLabel } from './format';
import { SPARKLE } from './render';

const t = strings.popover;
const SPARKLE_SMALL = 'M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z';
const SETTINGS_REASONS: readonly AIErrorReason[] = ['missing_ai_key', 'bad_ai_key'];

export function renderAiBlock(info: TitleInfo, result: AiOk): HTMLElement {
  const kind = kindLabel(info.kind);
  const { opinion } = result;
  return h(
    'div',
    { class: 'ai-box' },
    h(
      'div',
      { class: 'ai-head' },
      h('div', { class: 'ai-title' }, icon([...SPARKLE, SPARKLE_SMALL], { size: 16, stroke: '#ffffff' }), t.ai),
      h('span', { class: 'ai-provider' }, t.aiProvider(result.providerLabel, result.model)),
    ),
    h(
      'div',
      { class: 'ai-verdict' },
      h('span', { class: 'ai-verdict-label' }, t.aiConclusion),
      h('span', { class: `badge badge-sm badge-${opinion.verdict}` }, strings.verdict[opinion.verdict]),
    ),
    h('p', { class: 'ai-reason' }, opinion.reason_vi),
    h('span', { class: 'ai-foot' }, result.tasteCount > 0 ? t.aiTaste(kind, result.tasteCount) : t.aiNoTaste(kind)),
  );
}

export function renderAiError(reason: AIErrorReason, openSettings: () => void): HTMLElement {
  const message = strings.aiError[reason];
  if (!SETTINGS_REASONS.includes(reason)) return h('p', { class: 'ai-error', role: 'alert' }, message);
  return h(
    'p',
    { class: 'ai-error', role: 'alert' },
    `${message}, `,
    h('button', { type: 'button', class: 'link-btn', onclick: openSettings }, t.openSettings),
  );
}

function slot(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('.ai-slot');
}

function button(root: HTMLElement): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>('.btn-ai');
}

function setButtonLabel(root: HTMLElement, text: string): void {
  const label = root.querySelector('.btn-ai-label');
  if (label) label.textContent = text;
}

function idleLabel(root: HTMLElement): string {
  return root.querySelector('.ai-box') ? t.aiAgain : t.ai;
}

export function setAiLoading(root: HTMLElement, loading: boolean): void {
  const btn = button(root);
  if (btn) btn.disabled = loading;
  setButtonLabel(root, loading ? t.aiLoading : idleLabel(root));
}

export function isAiLoading(root: HTMLElement): boolean {
  return button(root)?.disabled ?? false;
}

function showSummary(root: HTMLElement, text: string): void {
  let section = root.querySelector<HTMLElement>('.synopsis-section');
  if (!section) {
    section = h('div', { class: 'section synopsis-section' }, h('span', { class: 'label' }), h('p', { class: 'synopsis' }));
    slot(root)?.before(section);
  }
  const label = section.querySelector('.label');
  const p = section.querySelector('p');
  if (label) label.textContent = t.synopsis;
  if (p) {
    p.className = 'synopsis';
    p.textContent = text;
  }
}

export function applyAiResult(root: HTMLElement, info: TitleInfo, result: AiOk): void {
  slot(root)?.replaceChildren(renderAiBlock(info, result));
  if (needSummary(info)) showSummary(root, result.opinion.summary_vi);
  setAiLoading(root, false);
}

export function applyAiError(root: HTMLElement, reason: AIErrorReason, openSettings: () => void): void {
  slot(root)?.replaceChildren(renderAiError(reason, openSettings));
  setAiLoading(root, false);
}
