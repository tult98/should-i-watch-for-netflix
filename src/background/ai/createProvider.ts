import { AI_PROVIDERS } from '../../shared/aiProviders';
import type { FetchFn } from '../requestQueue';
import { createAiClient, type AiClient, type ProviderConfig, type TransportFactory } from './aiCore';
import { anthropicTransport } from './anthropicTransport';
import { geminiTransport } from './geminiTransport';
import { openaiTransport } from './openaiTransport';

const TRANSPORTS: Record<ProviderConfig['format'], TransportFactory> = {
  openai: openaiTransport,
  anthropic: anthropicTransport,
  gemini: geminiTransport,
};

export function createProvider(fetch: FetchFn, config: ProviderConfig): AiClient {
  const keyRequired = config.keyRequired ?? (config.provider ? AI_PROVIDERS[config.provider].keyRequired : true);
  const resolved = { ...config, keyRequired };
  return createAiClient(new URL(config.baseUrl).host, TRANSPORTS[config.format](fetch, resolved));
}

export function providerLabel(config: Pick<ProviderConfig, 'provider' | 'baseUrl'>): string {
  if (config.provider && config.provider !== 'custom') return AI_PROVIDERS[config.provider].label;
  return new URL(config.baseUrl).hostname;
}
