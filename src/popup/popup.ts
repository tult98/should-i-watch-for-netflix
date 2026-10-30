import './popup.css';
import { chromeLocalStore, clearLookupCache } from '../background/cache';
import { createTasteStore } from '../background/taste/tasteStore';
import { appName } from '../shared/appName';
import { loadSettings, saveEnabled } from '../shared/settings';
import { popupModel } from './model';
import { renderPopup } from './view';

async function main(): Promise<void> {
  document.title = appName();
  const app = document.getElementById('app');
  if (!app) throw new Error('popup.html is missing #app');
  const store = chromeLocalStore();
  const [settings, ratings] = await Promise.all([loadSettings(), createTasteStore(store).listRatings()]);
  app.replaceChildren(
    renderPopup(
      popupModel(settings, ratings),
      {
        toggle: async (enabled) => void (await saveEnabled(enabled)),
        openSettings: () => {
          void chrome.runtime.openOptionsPage().then(() => window.close());
        },
        clearCache: () => clearLookupCache(store),
      },
      appName(),
    ),
  );
}

void main();
