import './options.css';
import { appName } from '../shared/appName';
import { loadSettings, saveSettings, type Settings } from '../shared/settings';
import { strings } from '../shared/strings.vi';

const t = strings.options;

interface Field {
  key: keyof Settings;
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
const inputs = FIELDS.map((field) => ({ field, input: byId<HTMLInputElement>(field.id) }));

function renderStatic(): void {
  const name = appName();
  document.title = name;
  byId('app-name').textContent = name;
  button.textContent = t.save;
  for (const field of FIELDS) {
    byId(`${field.id}-label`).textContent = field.label;
    const link = document.createElement('a');
    link.href = field.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = field.linkText;
    byId(`${field.id}-hint`).replaceChildren(field.hintBefore, link, field.hintAfter);
  }
}

function fill(settings: Settings): void {
  for (const { field, input } of inputs) input.value = settings[field.key] ?? '';
}

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle('error', isError);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  button.disabled = true;
  setStatus(t.saving);
  const draft: Settings = {};
  for (const { field, input } of inputs) draft[field.key] = input.value;
  saveSettings(draft)
    .then((saved) => {
      fill(saved);
      setStatus(t.saved);
    })
    .catch(() => setStatus(t.saveFailed, true))
    .finally(() => {
      button.disabled = false;
    });
});

for (const { input } of inputs) input.addEventListener('input', () => setStatus(''));

renderStatic();
void loadSettings().then(fill);
