import { AIError } from './AIProvider';
import type { TransportFactory } from './aiCore';
import { httpError, keyOf, parseBody, postJson } from './transportHttp';

function statusError(status: number, body: string): AIError {
  if (status === 401) return new AIError('bad_ai_key');
  if (status === 402) return new AIError('ai_no_balance');
  if (status === 429) return new AIError('rate_limited');
  return httpError(status, body);
}

function readContent(body: unknown): string | undefined {
  const content = (body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : undefined;
}

export const openaiTransport: TransportFactory = (fetch, config) => async (messages, opts = {}) => {
  const key = keyOf(config);
  const reply = await postJson(
    fetch,
    config.baseUrl,
    key ? { Authorization: `Bearer ${key}` } : {},
    {
      model: config.model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      ...(opts.maxTokens && { max_tokens: opts.maxTokens }),
    },
  );
  if (!reply.ok) throw statusError(reply.status, reply.text);
  return readContent(parseBody(reply.text));
};
