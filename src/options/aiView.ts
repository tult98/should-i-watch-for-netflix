import { h } from '../content/popover/dom';
import { AI_PROVIDERS, API_FORMATS, DEFAULT_AI_PROVIDER, type AiProviderId, type ApiFormat } from '../shared/aiProviders';
import { aiProfileOf, aiProviderOf, parseAiBaseUrl, type Settings } from '../shared/settings';
import { strings } from '../shared/i18n';
import { permissionHostFor, type AiDraft, type ConnectionResult } from './ai';
import { renderListbox } from './listbox';
import { renderProviderSelect } from './providerSelect';
import type { SaveResult } from './save';
import { actions, button, link, section, setStatus, statusLine, textField } from './ui';

const t = strings.options;

export interface AiViewDeps {
  save(draft: AiDraft): Promise<SaveResult>;
  test(draft: AiDraft): Promise<ConnectionResult>;
}

export interface AiView {
  element: HTMLElement;
  fill(settings: Settings): void;
}

function originOf(baseUrl: string): string {
  return parseAiBaseUrl(baseUrl)?.origin ?? baseUrl;
}

function connectionText(result: ConnectionResult, baseUrl: string): string {
  if (result.ok) return t.testOk(result.ms);
  if (result.reason === 'invalid_url') return t.invalidAiBaseUrl;
  if (result.reason === 'denied') return t.permissionDeniedTest(originOf(baseUrl));
  return strings.aiError[result.reason];
}

export function renderAiSection(deps: AiViewDeps): AiView {
  let saved: Settings = {};
  let provider: AiProviderId = DEFAULT_AI_PROVIDER;

  const providerLabel = h('label', { id: 'ai-provider-label', for: 'ai-provider' }, t.providerLabel);
  const select = renderProviderSelect('ai-provider', 'ai-provider-label', (id) => load(id, true));
  const model = textField('ai-model', t.aiModelLabel);
  const models = h('datalist', { id: 'ai-models' });
  model.input.setAttribute('list', 'ai-models');
  model.wrap.appendChild(models);
  const key = textField('ai-key', t.aiKeyLabel, { type: 'password', hint: [] });
  const keyHint = key.wrap.querySelector('.hint')!;
  const formatLabel = h('label', { id: 'ai-format-label', for: 'ai-format' }, t.apiFormatLabel);
  const format = renderListbox<ApiFormat>({
    id: 'ai-format',
    labelledBy: 'ai-format-label',
    items: API_FORMATS.map((f) => ({ value: f.id, content: () => [h('span', { class: 'p-label' }, f.label)] })),
    initial: 'openai',
    optionAttr: 'data-format',
    compact: true,
    onChange: () => setStatus(status, ''),
  });
  const baseUrl = textField('ai-base-url', t.aiBaseUrlLabel, { hint: [t.aiBaseUrlHint], inputmode: 'url' });
  const advanced = h(
    'details',
    { class: 'advanced' },
    h('summary', null, t.aiAdvanced),
    h(
      'div',
      { class: 'advanced-body' },
      h('div', { class: 'field' }, formatLabel, format.element),
      baseUrl.wrap,
    ),
  );
  const permission = h('div', { class: 'info', role: 'note', hidden: '' });
  const status = statusLine();

  function draft(): AiDraft {
    const preset = AI_PROVIDERS[provider];
    return {
      provider,
      format: format.value(),
      baseUrl: baseUrl.input.value.trim() || preset.baseUrl,
      model: model.input.value.trim() || preset.model,
      key: key.input.value.trim() || undefined,
    };
  }

  function showKeyHint(): void {
    const preset = AI_PROVIDERS[provider];
    keyHint.replaceChildren(
      t.aiKeyHint,
      ...(preset.keyUrl ? [' ', t.aiKeyGetAt, link(preset.keyUrl, preset.keyUrl.replace(/^https:\/\//, '')), '.'] : []),
      ...(preset.keyRequired ? [] : [' ', t.aiKeyOptional]),
    );
  }

  function showPermission(): void {
    const host = permissionHostFor(draft().baseUrl);
    permission.hidden = host === null;
    permission.textContent = host === null ? '' : t.aiPermissionNote(host);
  }

  function load(id: AiProviderId, userPicked: boolean): void {
    provider = id;
    const preset = AI_PROVIDERS[id];
    const profile = aiProfileOf(saved, id);
    select.set(id);
    format.set(profile.format);
    baseUrl.input.value = profile.baseUrl;
    baseUrl.input.placeholder = preset.baseUrl;
    model.input.value = profile.model;
    model.input.placeholder = preset.model;
    models.replaceChildren(...preset.models.map((m) => h('option', { value: m })));
    key.input.value = profile.key ?? '';
    if (id === 'custom') advanced.open = true;
    showKeyHint();
    showPermission();
    if (userPicked) setStatus(status, '');
  }

  const save = button(t.saveAi, 'primary', () => {
    const value = draft();
    save.disabled = true;
    setStatus(status, t.saving);
    deps
      .save(value)
      .then((result) => {
        if (result.status === 'refused') {
          setStatus(status, result.reason === 'invalid_url' ? t.invalidAiBaseUrl : t.permissionDenied(originOf(value.baseUrl)), true);
          return;
        }
        fill(result.saved);
        setStatus(status, t.saved);
      })
      .catch(() => setStatus(status, t.saveFailed, true))
      .finally(() => {
        save.disabled = false;
      });
  });

  const test = button(t.testConnection, 'secondary', () => {
    const value = draft();
    test.disabled = true;
    setStatus(status, t.testing);
    deps
      .test(value)
      .then((result) => setStatus(status, connectionText(result, value.baseUrl), !result.ok))
      .finally(() => {
        test.disabled = false;
      });
  });

  function fill(settings: Settings): void {
    saved = settings;
    load(aiProviderOf(settings), false);
  }

  for (const input of [model.input, key.input, baseUrl.input]) input.addEventListener('input', () => setStatus(status, ''));
  baseUrl.input.addEventListener('input', showPermission);

  const providerField = h(
    'div',
    { class: 'field' },
    providerLabel,
    select.element,
    h('span', { class: 'hint' }, t.providerHint),
  );
  const element = section(
    'ai',
    t.aiHeading,
    t.aiDescription,
    providerField,
    model.wrap,
    key.wrap,
    advanced,
    permission,
    actions(save, test, status),
  );
  fill({});
  return { element, fill };
}
