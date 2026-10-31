import { h, icon } from '../content/popover/dom';
import { AI_PROVIDERS, AI_PROVIDER_IDS, apiFormatLabel, type AiProviderId } from '../shared/aiProviders';
import { PROVIDER_LOGOS } from '../shared/providerLogos';
import { providerName } from '../shared/providerName';
import { renderListbox, type Listbox } from './listbox';

export type ProviderSelect = Listbox<AiProviderId>;

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

export function renderProviderSelect(id: string, labelledBy: string, onChange: (id: AiProviderId) => void): ProviderSelect {
  return renderListbox({
    id,
    labelledBy,
    items: AI_PROVIDER_IDS.map((pid) => ({ value: pid, content: () => body(pid) })),
    initial: 'deepseek',
    optionAttr: 'data-provider',
    onChange,
  });
}
