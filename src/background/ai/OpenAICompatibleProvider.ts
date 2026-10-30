import type { FetchFn } from '../requestQueue';
import { RequestError } from '../requestQueue';
import { AIError, type AIProvider, type AIOpinion, type OpinionInput } from './AIProvider';
import { buildMessages, correctionMessage, type ChatMessage } from './prompt';
import { validateOpinion } from './validate';

export const AI_TIMEOUT_MS = 30_000;
export const DEEPSEEK_ORIGIN = 'https://api.deepseek.com';

export interface AIConfig {
  baseUrl: string;
  model: string;
  key?: string;
}

export interface OpenAICompatibleProvider extends AIProvider {
  ping(): Promise<void>;
}

export function providerLabel(baseUrl: string): string {
  const host = new URL(baseUrl).hostname;
  return host === new URL(DEEPSEEK_ORIGIN).hostname ? 'DeepSeek' : host;
}

function statusError(status: number, body: string): AIError {
  if (status === 401) return new AIError('bad_ai_key');
  if (status === 402) return new AIError('ai_no_balance');
  if (status === 429) return new AIError('rate_limited');
  return new AIError('network', `HTTP ${status}: ${body.slice(0, 200)}`);
}

function readContent(body: unknown): string | undefined {
  const content = (body as { choices?: { message?: { content?: unknown } }[] } | null)?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : undefined;
}

export function createOpenAICompatibleProvider(fetch: FetchFn, config: AIConfig): OpenAICompatibleProvider {
  const key = config.key?.trim();

  async function complete(messages: ChatMessage[], extra: Record<string, unknown> = {}): Promise<string | undefined> {
    if (!key) throw new AIError('missing_ai_key');
    let response: Response;
    try {
      response = await fetch(config.baseUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.3,
          ...extra,
        }),
      });
    } catch (err) {
      if (err instanceof RequestError && err.reason === 'rate_limited') throw new AIError('rate_limited');
      throw new AIError('network', err instanceof Error ? err.message : String(err));
    }
    const text = await response.text().catch(() => '');
    if (!response.ok) throw statusError(response.status, text);
    try {
      return readContent(JSON.parse(text));
    } catch {
      return undefined;
    }
  }

  async function opinion(input: OpinionInput): Promise<AIOpinion> {
    const messages = buildMessages(input);
    const first = await complete(messages);
    const firstCheck = validateOpinion(first ?? '');
    if (firstCheck.ok) return firstCheck.opinion;
    const retry: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: first ?? '' },
      { role: 'user', content: correctionMessage(firstCheck.error) },
    ];
    const second = validateOpinion((await complete(retry)) ?? '');
    if (second.ok) return second.opinion;
    throw new AIError('ai_bad_response', second.error);
  }

  return {
    id: new URL(config.baseUrl).host,
    opinion,
    async ping() {
      await complete([{ role: 'user', content: 'Reply with the json object {"ok": true}.' }], { max_tokens: 16 });
    },
  };
}
