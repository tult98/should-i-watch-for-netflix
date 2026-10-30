import './options.css';
import { appName } from '../shared/appName';
import { chromeLocalStore, clearLookupCache } from '../background/cache';
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  chromeSettingsStore,
  loadSettings,
  parseAiBaseUrl,
  type AiKey,
  type Settings,
  type SourceKey,
} from '../shared/settings';
import { testAiConnection, type ConnectionResult } from './ai';
import { saveWithPermission } from './save';
import { strings } from '../shared/strings.vi';

const t = strings.options;

interface Field {
  key: SourceKey;
  id: string;
  label: string;
  hintBefore: string;
  hintAfter: string;
  url: string;
  linkText: string;
}

const FIELDS: Field[] = [
  {
    key: 'malClientId',
    id: 'mal-client-id',
    label: t.malClientIdLabel,
    hintBefore: t.malClientIdHintBefore,
    hintAfter: t.malClientIdHintAfter,
    url: 'https://myanimelist.net/apiconfig',
    linkText: 'myanimelist.net/apiconfig',
  },
  {
    key: 'tmdbKey',
    id: 'tmdb-key',
    label: t.tmdbKeyLabel,
    hintBefore: t.tmdbKeyHintBefore,
    hintAfter: t.tmdbKeyHintAfter,
    url: 'https://www.themoviedb.org/settings/api',
    linkText: 'themoviedb.org/settings/api',
  },
  {
    key: 'omdbKey',
    id: 'omdb-key',
    label: t.omdbKeyLabel,
    hintBefore: t.omdbKeyHintBefore,
    hintAfter: t.omdbKeyHintAfter,
    url: 'https://www.omdbapi.com/apikey.aspx',
    linkText: 'omdbapi.com/apikey.aspx',
  },
];

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`options.html is missing #${id}`);
  return el as T;
}

const form = byId<HTMLFormElement>('settings-form');
const button = byId<HTMLButtonElement>('save');
const status = byId<HTMLSpanElement>('status');
const clearButton = byId<HTMLButtonElement>('clear-cache');
const cacheStatus = byId<HTMLSpanElement>('cache-status');
const inputs = FIELDS.map((field) => ({ field, input: byId<HTMLInputElement>(field.id) }));
const aiInputs: Record<AiKey, HTMLInputElement> = {
  aiBaseUrl: byId('ai-base-url'),
  aiModel: byId('ai-model'),
  aiKey: byId('ai-key'),
};
const testButton = byId<HTMLButtonElement>('ai-test');
const testStatus = byId<HTMLSpanElement>('ai-test-status');

function renderStatic(): void {
  const name = appName();
  document.title = name;
  byId('app-name').textContent = name;
  button.textContent = t.save;
  byId('cache-heading').textContent = t.cacheHeading;
  byId('cache-description').textContent = t.cacheDescription;
  clearButton.textContent = t.clearCache;
  for (const field of FIELDS) {
    byId(`${field.id}-label`).textContent = field.label;
    const link = document.createElement('a');
    link.href = field.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = field.linkText;
    byId(`${field.id}-hint`).replaceChildren(field.hintBefore, link, field.hintAfter);
  }
  byId('ai-heading').textContent = t.aiHeading;
  byId('ai-description').textContent = t.aiDescription;
  byId('ai-base-url-label').textContent = t.aiBaseUrlLabel;
  byId('ai-base-url-hint').textContent = t.aiBaseUrlHint;
  byId('ai-model-label').textContent = t.aiModelLabel;
  byId('ai-model-hint').textContent = t.aiModelHint;
  byId('ai-key-label').textContent = t.aiKeyLabel;
  const keyLink = document.createElement('a');
  keyLink.href = 'https://platform.deepseek.com/api_keys';
  keyLink.target = '_blank';
  keyLink.rel = 'noopener noreferrer';
  keyLink.textContent = 'platform.deepseek.com/api_keys';
  byId('ai-key-hint').replaceChildren(t.aiKeyHintBefore, keyLink, t.aiKeyHintAfter);
  aiInputs.aiBaseUrl.placeholder = DEFAULT_AI_BASE_URL;
  aiInputs.aiModel.placeholder = DEFAULT_AI_MODEL;
  testButton.textContent = t.testConnection;
}

function fill(settings: Settings): void {
  for (const { field, input } of inputs) input.value = settings[field.key] ?? '';
  aiInputs.aiBaseUrl.value = settings.aiBaseUrl ?? DEFAULT_AI_BASE_URL;
  aiInputs.aiModel.value = settings.aiModel ?? DEFAULT_AI_MODEL;
  aiInputs.aiKey.value = settings.aiKey ?? '';
}

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle('error', isError);
}

function setTestStatus(text: string, isError = false): void {
  testStatus.textContent = text;
  testStatus.classList.toggle('error', isError);
}

function aiDraft(): Pick<Settings, AiKey> {
  return { aiBaseUrl: aiInputs.aiBaseUrl.value, aiModel: aiInputs.aiModel.value, aiKey: aiInputs.aiKey.value };
}

function originOf(baseUrl: string): string {
  return parseAiBaseUrl(baseUrl)?.origin ?? baseUrl;
}

function connectionText(result: ConnectionResult, baseUrl: string): string {
  if (result.ok) return t.testOk;
  if (result.reason === 'invalid_url') return t.invalidAiBaseUrl;
  if (result.reason === 'denied') return t.permissionDeniedTest(originOf(baseUrl));
  return strings.aiError[result.reason];
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  button.disabled = true;
  setStatus(t.saving);
  const draft: Settings = aiDraft();
  for (const { field, input } of inputs) draft[field.key] = input.value;
  saveWithPermission(draft, chrome.permissions, chromeSettingsStore(), chromeLocalStore())
    .then((result) => {
      if (result.status === 'refused') {
        const url = draft.aiBaseUrl ?? '';
        setStatus(result.reason === 'invalid_url' ? t.invalidAiBaseUrl : t.permissionDenied(originOf(url)), true);
        return;
      }
      fill(result.saved);
      setStatus(result.cacheCleared ? t.savedCacheCleared : t.saved);
    })
    .catch(() => setStatus(t.saveFailed, true))
    .finally(() => {
      button.disabled = false;
    });
});

clearButton.addEventListener('click', () => {
  clearButton.disabled = true;
  cacheStatus.classList.remove('error');
  cacheStatus.textContent = t.clearingCache;
  clearLookupCache(chromeLocalStore())
    .then((count) => {
      cacheStatus.textContent = t.cacheCleared(count);
    })
    .catch(() => {
      cacheStatus.textContent = t.clearCacheFailed;
      cacheStatus.classList.add('error');
    })
    .finally(() => {
      clearButton.disabled = false;
    });
});

testButton.addEventListener('click', () => {
  const draft = aiDraft();
  testButton.disabled = true;
  setTestStatus(t.testing);
  testAiConnection(draft, chrome.permissions, (url, init) => fetch(url, init))
    .then((result) => setTestStatus(connectionText(result, draft.aiBaseUrl ?? ''), !result.ok))
    .finally(() => {
      testButton.disabled = false;
    });
});

for (const input of [...inputs.map((i) => i.input), ...Object.values(aiInputs)]) {
  input.addEventListener('input', () => {
    setStatus('');
    setTestStatus('');
  });
}

renderStatic();
void loadSettings().then(fill);
