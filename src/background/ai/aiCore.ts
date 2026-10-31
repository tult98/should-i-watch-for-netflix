import type { AiProviderId, ApiFormat } from '../../shared/aiProviders';
import type { FetchFn } from '../requestQueue';
import { AIError, type AIProvider, type AIOpinion, type OpinionInput } from './AIProvider';
import { buildMessages, correctionMessage, type ChatMessage } from './prompt';
import { parseJsonObject, validateOpinion } from './validate';

export interface ProviderConfig {
  provider?: AiProviderId;
  format: ApiFormat;
  baseUrl: string;
  model: string;
  key?: string;
  keyRequired?: boolean;
}

export interface CompleteOptions {
  maxTokens?: number;
}

export type Transport = (messages: ChatMessage[], opts?: CompleteOptions) => Promise<string | undefined>;

export type TransportFactory = (fetch: FetchFn, config: ProviderConfig) => Transport;

export interface AiClient extends AIProvider {
  ping(): Promise<void>;
}

export function createAiClient(id: string, complete: Transport): AiClient {
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

  async function ping(): Promise<void> {
    const reply = await complete([{ role: 'user', content: 'Reply with the json object {"ok": true}.' }], { maxTokens: 16 });
    const parsed = parseJsonObject(reply ?? '');
    if (!parsed.ok) throw new AIError('ai_bad_response', parsed.error);
  }

  return { id, opinion, ping };
}
