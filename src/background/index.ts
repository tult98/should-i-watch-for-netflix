import { isLookupRequest, type LookupResponse } from '../shared/messages';
import { loadSettings } from '../shared/settings';
import { createJikanAdapter } from './adapters/JikanAdapter';
import { createMalOfficialAdapter } from './adapters/MalOfficialAdapter';
import { createOmdbAdapter } from './adapters/OmdbAdapter';
import { createTmdbAdapter } from './adapters/TmdbAdapter';
import { chromeLocalStore, createLookupCache } from './cache';
import { createLookup } from './lookup';
import { createRequestQueue } from './requestQueue';

const queue = createRequestQueue({ fetch: (url, init) => fetch(url, init) });

const lookup = createLookup({
  cache: createLookupCache(chromeLocalStore()),
  loadSettings: () => loadSettings(),
  jikan: createJikanAdapter(queue.fetch),
  malOfficial: (clientId) => createMalOfficialAdapter(queue.fetch, clientId),
  tmdb: (key) => createTmdbAdapter(queue.fetch, key),
  omdb: (key) => createOmdbAdapter(queue.fetch, key),
  log: (message) => console.log(message),
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (r: LookupResponse) => void) => {
  if (!isLookupRequest(message)) return false;
  void lookup(message)
    .catch((): LookupResponse => ({ status: 'error', reason: 'network' }))
    .then(sendResponse);
  return true;
});
