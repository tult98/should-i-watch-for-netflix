import { AIError } from '../background/ai/AIProvider';
import { AI_TIMEOUT_MS, DEEPSEEK_ORIGIN } from '../background/ai/OpenAICompatibleProvider';
import { createProvider } from '../background/ai/createProvider';
import { createRequestQueue, type FetchFn } from '../background/requestQueue';
import type { AiProviderId, ApiFormat } from '../shared/aiProviders';
import { parseAiBaseUrl } from '../shared/settings';
import type { AIErrorReason } from '../shared/types';

export interface PermissionsApi {
  request(permissions: { origins: string[] }): Promise<boolean>;
}

export type PermissionOutcome = 'granted' | 'invalid_url' | 'denied';

// Permission patterns ignore ports, so the pattern is built from the hostname.
function permissionPattern(url: URL): string {
  return `${url.protocol}//${url.hostname}/*`;
}

function grantedByManifest(url: URL): boolean {
  return url.origin === DEEPSEEK_ORIGIN;
}

// The host Chrome will ask about when this Base URL is saved, or null when no prompt will appear.
export function permissionHostFor(baseUrl: string): string | null {
  const url = parseAiBaseUrl(baseUrl);
  return url && !grantedByManifest(url) ? url.hostname : null;
}

// Must run before the first await of a click handler, since Chrome only grants a request made during the user gesture.
export function ensureAiPermission(baseUrl: string | undefined, permissions: PermissionsApi): Promise<PermissionOutcome> {
  const url = parseAiBaseUrl(baseUrl ?? '');
  if (!url) return Promise.resolve('invalid_url');
  if (grantedByManifest(url)) return Promise.resolve('granted');
  return permissions.request({ origins: [permissionPattern(url)] }).then(
    (granted): PermissionOutcome => (granted ? 'granted' : 'denied'),
    (): PermissionOutcome => 'denied',
  );
}

export interface AiDraft {
  provider: AiProviderId;
  format: ApiFormat;
  baseUrl: string;
  model: string;
  key?: string;
}

export type ConnectionResult =
  | { ok: true; ms: number }
  | { ok: false; reason: AIErrorReason | 'invalid_url' | 'denied' };

export async function testAiConnection(
  draft: AiDraft,
  permissions: PermissionsApi,
  fetch: FetchFn,
): Promise<ConnectionResult> {
  const permission = await ensureAiPermission(draft.baseUrl, permissions);
  if (permission !== 'granted') return { ok: false, reason: permission };
  const queue = createRequestQueue({ fetch, timeoutFor: () => AI_TIMEOUT_MS });
  const provider = createProvider(queue.fetch, draft);
  const started = performance.now();
  try {
    await provider.ping();
    return { ok: true, ms: Math.round(performance.now() - started) };
  } catch (err) {
    return { ok: false, reason: err instanceof AIError ? err.reason : 'network' };
  }
}
