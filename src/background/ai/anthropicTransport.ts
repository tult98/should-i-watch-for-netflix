import { AIError } from './AIProvider';
import type { TransportFactory } from './aiCore';
import { httpError, keyOf, parseBody, postJson } from './transportHttp';

const DEFAULT_MAX_TOKENS = 1024;

function errorMessage(body: string): string {
  const message = (parseBody(body) as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === 'string' ? message : body;
}

function statusError(status: number, body: string): AIError {
  if (status === 401 || status === 403) return new AIError('bad_ai_key');
  if (status === 429) return new AIError('rate_limited');
  if (status === 400 && /credit balance/i.test(errorMessage(body))) return new AIError('ai_no_balance');
  return httpError(status, body);
}

function readText(body: unknown): string | undefined {
  const blocks = (body as { content?: { type?: unknown; text?: unknown }[] } | null)?.content;
  if (!Array.isArray(blocks)) return undefined;
  const texts = blocks.flatMap((b) => (typeof b?.text === 'string' ? [b.text] : []));
  return texts.length > 0 ? texts.join('') : undefined;
}

export const anthropicTransport: TransportFactory = (fetch, config) => async (messages, opts = {}) => {
  const key = keyOf(config);
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const reply = await postJson(
    fetch,
    config.baseUrl,
    {
      'x-api-key': key ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    {
      model: config.model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: 0.3,
      system,
      messages: messages.filter((m) => m.role !== 'system'),
    },
  );
  if (!reply.ok) throw statusError(reply.status, reply.text);
  return readText(parseBody(reply.text));
};
