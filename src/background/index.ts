import { isLookupRequest, type LookupResponse } from '../shared/messages';
import { createJikanAdapter } from './adapters/JikanAdapter';
import { chromeLocalStore, createLookupCache } from './cache';
import { createLookup } from './lookup';
import { createRequestQueue } from './requestQueue';

const queue = createRequestQueue({ fetch: (url, init) => fetch(url, init) });

const lookup = createLookup({
  cache: createLookupCache(chromeLocalStore()),
  mal: createJikanAdapter(queue.fetch),
  log: (message) => console.log(message),
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (r: LookupResponse) => void) => {
  if (!isLookupRequest(message)) return false;
  void lookup(message)
    .catch((): LookupResponse => ({ status: 'error', reason: 'network' }))
    .then(sendResponse);
  return true;
});
