import { AI_PROVIDERS, type AiProviderId } from './aiProviders';
import { strings } from './i18n';

export function providerName(id: AiProviderId): string {
  return id === 'custom' ? strings.options.providerCustom : AI_PROVIDERS[id].label;
}
