import type { FetchFn } from '../requestQueue';
import { createAiClient, type AiClient } from './aiCore';
import { openaiTransport } from './openaiTransport';

export const AI_TIMEOUT_MS = 30_000;
export const DEEPSEEK_ORIGIN = 'https://api.deepseek.com';

export interface AIConfig {
  baseUrl: string;
  model: string;
  key?: string;
}

export type OpenAICompatibleProvider = AiClient;

export function providerLabel(baseUrl: string): string {
  const host = new URL(baseUrl).hostname;
  return host === new URL(DEEPSEEK_ORIGIN).hostname ? 'DeepSeek' : host;
}

export function createOpenAICompatibleProvider(fetch: FetchFn, config: AIConfig): OpenAICompatibleProvider {
  const resolved = { ...config, format: 'openai' as const };
  return createAiClient(new URL(config.baseUrl).host, openaiTransport(fetch, resolved));
}
