import { AIError } from '../background/ai/AIProvider';
import { AI_TIMEOUT_MS, DEEPSEEK_ORIGIN, createOpenAICompatibleProvider } from '../background/ai/OpenAICompatibleProvider';
import { createRequestQueue, type FetchFn } from '../background/requestQueue';
import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL, parseAiBaseUrl } from '../shared/settings';
import type { AIErrorReason } from '../shared/types';

export interface PermissionsApi {
  request(permissions: { origins: string[] }): Promise<boolean>;
}

export type PermissionOutcome = 'granted' | 'invalid_url' | 'denied';

// Must run before the first await of a click handler, since Chrome only grants a request made during the user gesture.
export function ensureAiPermission(baseUrl: string | undefined, permissions: PermissionsApi): Promise<PermissionOutcome> {
  const url = parseAiBaseUrl(baseUrl?.trim() || DEFAULT_AI_BASE_URL);
  if (!url) return Promise.resolve('invalid_url');
  if (url.origin === DEEPSEEK_ORIGIN) return Promise.resolve('granted');
  return permissions.request({ origins: [`${url.origin}/*`] }).then(
    (granted): PermissionOutcome => (granted ? 'granted' : 'denied'),
    (): PermissionOutcome => 'denied',
  );
}

export interface AiDraft {
  aiBaseUrl?: string;
  aiModel?: string;
  aiKey?: string;
}

export type ConnectionResult = { ok: true } | { ok: false; reason: AIErrorReason | 'invalid_url' | 'denied' };

export async function testAiConnection(
  draft: AiDraft,
  permissions: PermissionsApi,
  fetch: FetchFn,
): Promise<ConnectionResult> {
  const permission = await ensureAiPermission(draft.aiBaseUrl, permissions);
  if (permission !== 'granted') return { ok: false, reason: permission };
  const queue = createRequestQueue({ fetch, timeoutFor: () => AI_TIMEOUT_MS });
  const provider = createOpenAICompatibleProvider(queue.fetch, {
    baseUrl: draft.aiBaseUrl?.trim() || DEFAULT_AI_BASE_URL,
    model: draft.aiModel?.trim() || DEFAULT_AI_MODEL,
    key: draft.aiKey,
  });
  try {
    await provider.ping();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof AIError ? err.reason : 'network' };
  }
}
