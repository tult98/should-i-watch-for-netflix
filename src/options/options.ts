import './options.css';
import { chromeLocalStore, clearLookupCache } from '../background/cache';
import { buildProfile } from '../background/taste/tasteProfile';
import { RATINGS_KEY, VERSIONS_KEY, createTasteStore, type RatedTitle, type TasteVersions } from '../background/taste/tasteStore';
import { h } from '../content/popover/dom';
import { appName } from '../shared/appName';
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  DEFAULT_THRESHOLDS,
  chromeSettingsStore,
  loadSettings,
  parseAiBaseUrl,
  thresholdsOf,
  type Settings,
  type SourceKey,
} from '../shared/settings';
import { strings } from '../shared/strings.vi';
import type { Kind } from '../shared/types';
import { testAiConnection, type ConnectionResult } from './ai';
import { saveAndInvalidate, saveThresholdSet, saveWithPermission } from './save';
import { renderTasteBody } from './tasteView';
import { renderThresholdSection, type ThresholdView } from './thresholdView';
import { SET_KEYS, parseThresholdForm, type SetKey } from './thresholds';
import { actions, button, link, section, setStatus, statusLine, textField, type TextField } from './ui';

const t = strings.options;
const KINDS: readonly Kind[] = ['anime', 'movie', 'series'];

function originOf(baseUrl: string): string {
  return parseAiBaseUrl(baseUrl)?.origin ?? baseUrl;
}

function connectionText(result: ConnectionResult, baseUrl: string): string {
  if (result.ok) return t.testOk;
  if (result.reason === 'invalid_url') return t.invalidAiBaseUrl;
  if (result.reason === 'denied') return t.permissionDeniedTest(originOf(baseUrl));
  return strings.aiError[result.reason];
}

function clearOnInput(fields: TextField[], ...statuses: HTMLElement[]): void {
  for (const { input } of fields) input.addEventListener('input', () => statuses.forEach((s) => setStatus(s, '')));
}

function header(): HTMLElement {
  return h(
    'header',
    { class: 'page-head' },
    h('span', { class: 'eyebrow' }, t.eyebrow),
    h('h1', null, appName()),
    h('p', { class: 'privacy' }, t.privacy),
  );
}

function aiSection(fillers: ((s: Settings) => void)[]): HTMLElement {
  const model = textField('ai-model', t.aiModelLabel, { hint: [t.aiModelHint], placeholder: DEFAULT_AI_MODEL });
  const baseUrl = textField('ai-base-url', t.aiBaseUrlLabel, {
    hint: [t.aiBaseUrlHint],
    placeholder: DEFAULT_AI_BASE_URL,
    inputmode: 'url',
  });
  const key = textField('ai-key', t.aiKeyLabel, {
    type: 'password',
    hint: [t.aiKeyHintBefore, link('https://platform.deepseek.com/api_keys', 'platform.deepseek.com/api_keys'), t.aiKeyHintAfter],
  });
  const status = statusLine();
  const draft = () => ({ aiBaseUrl: baseUrl.input.value, aiModel: model.input.value, aiKey: key.input.value });

  const save = button(t.saveAi, 'primary', () => {
    const value = draft();
    save.disabled = true;
    setStatus(status, t.saving);
    saveWithPermission(value, chrome.permissions, chromeSettingsStore(), chromeLocalStore())
      .then((result) => {
        if (result.status === 'refused') {
          setStatus(status, result.reason === 'invalid_url' ? t.invalidAiBaseUrl : t.permissionDenied(originOf(value.aiBaseUrl)), true);
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
    testAiConnection(value, chrome.permissions, (url, init) => fetch(url, init))
      .then((result) => setStatus(status, connectionText(result, value.aiBaseUrl), !result.ok))
      .finally(() => {
        test.disabled = false;
      });
  });

  function fill(settings: Settings): void {
    baseUrl.input.value = settings.aiBaseUrl ?? DEFAULT_AI_BASE_URL;
    model.input.value = settings.aiModel ?? DEFAULT_AI_MODEL;
    key.input.value = settings.aiKey ?? '';
  }
  fillers.push(fill);
  clearOnInput([model, baseUrl, key], status);

  return section(
    'ai',
    t.aiHeading,
    t.aiDescription,
    h('div', { class: 'grid' }, model.wrap),
    baseUrl.wrap,
    key.wrap,
    actions(save, test, status),
  );
}

interface SourceField {
  key: SourceKey;
  field: TextField;
}

function sourcesSection(fillers: ((s: Settings) => void)[]): HTMLElement {
  const fields: SourceField[] = [
    {
      key: 'malClientId',
      field: textField('mal-client-id', t.malClientIdLabel, {
        type: 'password',
        hint: [t.malClientIdHintBefore, link('https://myanimelist.net/apiconfig', 'myanimelist.net/apiconfig'), t.malClientIdHintAfter],
      }),
    },
    {
      key: 'tmdbKey',
      field: textField('tmdb-key', t.tmdbKeyLabel, {
        type: 'password',
        hint: [t.tmdbKeyHintBefore, link('https://www.themoviedb.org/settings/api', 'themoviedb.org/settings/api'), t.tmdbKeyHintAfter],
      }),
    },
    {
      key: 'omdbKey',
      field: textField('omdb-key', t.omdbKeyLabel, {
        type: 'password',
        placeholder: t.omdbKeyPlaceholder,
        hint: [t.omdbKeyHintBefore, link('https://www.omdbapi.com/apikey.aspx', 'omdbapi.com/apikey.aspx'), t.omdbKeyHintAfter],
      }),
    },
  ];
  const status = statusLine();

  function fill(settings: Settings): void {
    for (const { key, field } of fields) field.input.value = settings[key] ?? '';
  }
  fillers.push(fill);

  const save = button(t.saveSources, 'primary', () => {
    const draft: Settings = {};
    for (const { key, field } of fields) draft[key] = field.input.value;
    save.disabled = true;
    setStatus(status, t.saving);
    saveAndInvalidate(draft, chromeSettingsStore(), chromeLocalStore())
      .then((result) => {
        fill(result.saved);
        setStatus(status, result.cacheCleared ? t.savedCacheCleared : t.saved);
      })
      .catch(() => setStatus(status, t.saveFailed, true))
      .finally(() => {
        save.disabled = false;
      });
  });
  clearOnInput(
    fields.map((f) => f.field),
    status,
  );

  return section('sources', t.sourcesHeading, t.sourcesDescription, ...fields.map((f) => f.field.wrap), actions(save, status));
}

function thresholdSection(set: SetKey, fillers: ((s: Settings) => void)[]): HTMLElement {
  function persist(view: ThresholdView, value: Parameters<typeof saveThresholdSet>[1], done: string): void {
    setStatus(view.status, t.saving);
    saveThresholdSet(set, value, chromeSettingsStore())
      .then((saved) => {
        view.fill(thresholdsOf(saved)[set]);
        setStatus(view.status, done);
      })
      .catch(() => setStatus(view.status, t.saveFailed, true));
  }
  const view = renderThresholdSection(set, {
    onSave(v) {
      const result = parseThresholdForm(set, v.read());
      if (!result.ok) {
        v.showErrors(result.errors);
        setStatus(v.status, '');
        return;
      }
      v.showErrors([]);
      persist(v, result.value, t.saved);
    },
    onReset(v) {
      v.fill(DEFAULT_THRESHOLDS[set]);
      persist(v, DEFAULT_THRESHOLDS[set], t.thresholdsReset);
    },
  });
  fillers.push((settings) => view.fill(thresholdsOf(settings)[set]));
  return view.element;
}

function tasteSection(): HTMLElement {
  const taste = createTasteStore(chromeLocalStore());
  let kind: Kind = 'anime';
  let ratings: RatedTitle[] = [];
  let versions: TasteVersions = { anime: 0, movie: 0, series: 0 };

  const body = h('div', { class: 'taste-slot' });
  const pre = h('pre', { class: 'taste-data', id: 'taste-data', hidden: '' });
  const status = statusLine();
  const tabs = KINDS.map((k) =>
    h(
      'button',
      {
        type: 'button',
        role: 'tab',
        class: 'tab',
        'aria-selected': String(k === kind),
        onclick: () => {
          kind = k;
          render();
        },
      },
      strings.kind[k],
    ),
  );

  function render(): void {
    for (const [i, tab] of tabs.entries()) tab.setAttribute('aria-selected', String(KINDS[i] === kind));
    body.replaceChildren(renderTasteBody(buildProfile(ratings, kind, versions[kind], Date.now())));
    pre.textContent = JSON.stringify(ratings, null, 2);
  }

  async function reload(): Promise<void> {
    [ratings, versions] = await Promise.all([taste.listRatings(), taste.versions()]);
    render();
  }

  const toggle = button(t.showData, 'secondary', () => {
    pre.hidden = !pre.hidden;
    toggle.textContent = pre.hidden ? t.showData : t.hideData;
    toggle.setAttribute('aria-expanded', String(!pre.hidden));
  });
  toggle.setAttribute('aria-controls', pre.id);
  toggle.setAttribute('aria-expanded', 'false');

  const clear = button(t.clearTaste, 'danger', () => {
    if (!confirm(t.clearTasteConfirm)) return;
    clear.disabled = true;
    taste
      .clearAll()
      .then(() => setStatus(status, t.tasteCleared))
      .catch(() => setStatus(status, t.clearTasteFailed, true))
      .finally(() => {
        clear.disabled = false;
      });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (RATINGS_KEY in changes || VERSIONS_KEY in changes)) void reload();
  });
  void reload();

  return section(
    'taste',
    t.tasteHeading,
    t.tasteDescription,
    h('div', { class: 'tabs', role: 'tablist' }, ...tabs),
    body,
    actions(toggle, clear, status),
    pre,
  );
}

function cacheSection(): HTMLElement {
  const status = statusLine();
  const clear = button(t.clearCache, 'secondary', () => {
    clear.disabled = true;
    setStatus(status, t.clearingCache);
    clearLookupCache(chromeLocalStore())
      .then((count) => setStatus(status, t.cacheCleared(count)))
      .catch(() => setStatus(status, t.clearCacheFailed, true))
      .finally(() => {
        clear.disabled = false;
      });
  });
  return section('cache', t.cacheHeading, t.cacheDescription, actions(clear, status));
}

function main(): void {
  document.title = appName();
  const fillers: ((s: Settings) => void)[] = [];
  const app = document.getElementById('app');
  if (!app) throw new Error('options.html is missing #app');
  app.replaceChildren(
    header(),
    aiSection(fillers),
    sourcesSection(fillers),
    ...SET_KEYS.map((set) => thresholdSection(set, fillers)),
    tasteSection(),
    cacheSection(),
    h('footer', { class: 'page-foot' }, t.tmdbAttribution),
  );
  void loadSettings().then((settings) => fillers.forEach((fill) => fill(settings)));
}

main();
