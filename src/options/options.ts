import './options.css';
import { appName } from '../shared/appName';
import { loadSettings, saveSettings } from '../shared/settings';
import { strings } from '../shared/strings.vi';

const API_CONFIG_URL = 'https://myanimelist.net/apiconfig';
const t = strings.options;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`options.html is missing #${id}`);
  return el as T;
}

const form = byId<HTMLFormElement>('settings-form');
const input = byId<HTMLInputElement>('mal-client-id');
const button = byId<HTMLButtonElement>('save');
const status = byId<HTMLSpanElement>('status');

function renderStatic(): void {
  const name = appName();
  document.title = name;
  byId('app-name').textContent = name;
  byId('mal-client-id-label').textContent = t.malClientIdLabel;
  button.textContent = t.save;
  const link = document.createElement('a');
  link.href = API_CONFIG_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'myanimelist.net/apiconfig';
  byId('mal-client-id-hint').replaceChildren(t.malClientIdHintBefore, link, t.malClientIdHintAfter);
}

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.classList.toggle('error', isError);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  button.disabled = true;
  setStatus(t.saving);
  saveSettings({ malClientId: input.value })
    .then((saved) => {
      input.value = saved.malClientId ?? '';
      setStatus(t.saved);
    })
    .catch(() => setStatus(t.saveFailed, true))
    .finally(() => {
      button.disabled = false;
    });
});

input.addEventListener('input', () => setStatus(''));

renderStatic();
void loadSettings().then((settings) => {
  input.value = settings.malClientId ?? '';
});
