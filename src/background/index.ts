import {
  isAiCachedRequest,
  isAiOpinionRequest,
  isLookupRequest,
  isOpenOptionsRequest,
  type LookupResponse,
} from '../shared/messages';
import { loadSettings } from '../shared/settings';
import { createJikanAdapter } from './adapters/JikanAdapter';
import { createMalOfficialAdapter } from './adapters/MalOfficialAdapter';
import { createOmdbAdapter } from './adapters/OmdbAdapter';
import { createTmdbAdapter } from './adapters/TmdbAdapter';
import { createAiService } from './ai/aiService';
import { AI_TIMEOUT_MS, DEEPSEEK_ORIGIN, createOpenAICompatibleProvider } from './ai/OpenAICompatibleProvider';
import { chromeLocalStore, createLookupCache } from './cache';
import { createLookup } from './lookup';
import { createRequestQueue } from './requestQueue';
import { getTasteProfile } from './taste/tasteProfile';

const aiHosts = new Set([new URL(DEEPSEEK_ORIGIN).host]);

const queue = createRequestQueue({
  fetch: (url, init) => fetch(url, init),
  timeoutFor: (host) => (aiHosts.has(host) ? AI_TIMEOUT_MS : undefined),
});

const lookup = createLookup({
  cache: createLookupCache(chromeLocalStore()),
  loadSettings: () => loadSettings(),
  jikan: createJikanAdapter(queue.fetch),
  malOfficial: (clientId) => createMalOfficialAdapter(queue.fetch, clientId),
  tmdb: (key) => createTmdbAdapter(queue.fetch, key),
  omdb: (key) => createOmdbAdapter(queue.fetch, key),
  log: (message) => console.log(message),
});

const ai = createAiService({
  store: chromeLocalStore(),
  loadSettings: () => loadSettings(),
  getTasteProfile,
  provider: (config) => {
    aiHosts.add(new URL(config.baseUrl).host);
    return createOpenAICompatibleProvider(queue.fetch, config);
  },
  log: (message) => console.log(message),
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (r: unknown) => void) => {
  if (isLookupRequest(message)) {
    void lookup(message)
      .catch((): LookupResponse => ({ status: 'error', reason: 'network' }))
      .then(sendResponse);
    return true;
  }
  if (isAiOpinionRequest(message)) {
    void ai.opinion(message.info, message.badge).then(sendResponse);
    return true;
  }
  if (isAiCachedRequest(message)) {
    void ai
      .cached(message.info)
      .catch(() => ({ status: 'none' }))
      .then(sendResponse);
    return true;
  }
  if (isOpenOptionsRequest(message)) {
    void chrome.runtime.openOptionsPage();
    return false;
  }
  return false;
});
