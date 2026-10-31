import { describe, expect, it } from 'vitest';
import {
  AI_PROVIDERS,
  AI_PROVIDER_IDS,
  API_FORMATS,
  apiFormatLabel,
  isAiProviderId,
  isApiFormat,
} from '../src/shared/aiProviders';
import { PROVIDER_LOGOS } from '../src/shared/providerLogos';
import { parseAiBaseUrl } from '../src/shared/settings';

describe('AI provider registry', () => {
  it('keys every preset by its own id', () => {
    for (const [id, preset] of Object.entries(AI_PROVIDERS)) expect(preset.id).toBe(id);
    expect(AI_PROVIDER_IDS).toHaveLength(8);
  });

  it('gives every preset a valid format and a model that is among its suggestions', () => {
    for (const preset of Object.values(AI_PROVIDERS)) {
      expect(isApiFormat(preset.format)).toBe(true);
      expect(preset.color).toMatch(/^#[0-9a-f]{6}$/i);
      if (preset.id !== 'custom') expect(preset.models).toContain(preset.model);
    }
  });

  it('uses https or a local http base URL, leaving only Custom empty', () => {
    for (const preset of Object.values(AI_PROVIDERS)) {
      if (preset.id === 'custom') {
        expect(preset.baseUrl).toBe('');
        expect(preset.model).toBe('');
      } else {
        expect(parseAiBaseUrl(preset.baseUrl)).not.toBeNull();
      }
    }
  });

  it('points Gemini at the API root and keeps Ollama keyless', () => {
    expect(AI_PROVIDERS.gemini.baseUrl).toBe('https://generativelanguage.googleapis.com/v1beta');
    expect(AI_PROVIDERS.ollama.keyRequired).toBe(false);
    expect(Object.values(AI_PROVIDERS).filter((p) => !p.keyRequired)).toHaveLength(1);
  });

  it('recognises ids and formats', () => {
    expect(isAiProviderId('groq')).toBe(true);
    expect(isAiProviderId('toString')).toBe(false);
    expect(isApiFormat('gemini')).toBe(true);
    expect(isApiFormat('xml')).toBe(false);
    expect(API_FORMATS.map((f) => f.id)).toEqual(['openai', 'anthropic', 'gemini']);
    expect(apiFormatLabel('anthropic')).toBe('Anthropic (messages)');
  });
});

describe('provider logos', () => {
  it('has a logo for every preset except Custom', () => {
    for (const id of AI_PROVIDER_IDS) {
      if (id === 'custom') expect(PROVIDER_LOGOS[id]).toBeUndefined();
      else expect(PROVIDER_LOGOS[id]).toMatch(/^M[\d.\-]/);
    }
  });
});
