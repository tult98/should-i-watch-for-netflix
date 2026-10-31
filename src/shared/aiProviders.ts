export type ApiFormat = 'openai' | 'anthropic' | 'gemini';

export const API_FORMATS: readonly { id: ApiFormat; label: string }[] = [
  { id: 'openai', label: 'OpenAI-compatible (chat/completions)' },
  { id: 'anthropic', label: 'Anthropic (messages)' },
  { id: 'gemini', label: 'Google Gemini (generateContent)' },
];

export type AiProviderId = 'deepseek' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'groq' | 'ollama' | 'custom';

export interface AiPreset {
  id: AiProviderId;
  label: string;
  format: ApiFormat;
  baseUrl: string;
  model: string;
  models: string[];
  keyUrl?: string;
  keyRequired: boolean;
  color: string;
}

// The one place to edit provider defaults. Gemini's base is the API root, its adapter appends /models/{model}:generateContent.
export const AI_PROVIDERS: Record<AiProviderId, AiPreset> = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    format: 'openai',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    keyRequired: true,
    color: '#4d6bfe',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    format: 'openai',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
    keyUrl: 'https://platform.openai.com/api-keys',
    keyRequired: true,
    color: '#10a37f',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    format: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-haiku-4-5',
    models: ['claude-haiku-4-5', 'claude-sonnet-4-5'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyRequired: true,
    color: '#d97757',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    format: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    keyUrl: 'https://aistudio.google.com/apikey',
    keyRequired: true,
    color: '#4285f4',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    format: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openai/gpt-4.1-mini',
    models: ['openai/gpt-4.1-mini', 'anthropic/claude-haiku-4.5', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat'],
    keyUrl: 'https://openrouter.ai/keys',
    keyRequired: true,
    color: '#6467f2',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    format: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    keyUrl: 'https://console.groq.com/keys',
    keyRequired: true,
    color: '#f55036',
  },
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    format: 'openai',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3.2',
    models: ['llama3.2', 'qwen2.5', 'mistral'],
    keyRequired: false,
    color: '#5b6270',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    format: 'openai',
    baseUrl: '',
    model: '',
    models: [],
    keyRequired: true,
    color: '#8b8f98',
  },
};

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[];

export const DEFAULT_AI_PROVIDER: AiProviderId = 'deepseek';

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && Object.hasOwn(AI_PROVIDERS, value);
}

export function isApiFormat(value: unknown): value is ApiFormat {
  return API_FORMATS.some((f) => f.id === value);
}

export function apiFormatLabel(format: ApiFormat): string {
  return API_FORMATS.find((f) => f.id === format)?.label ?? format;
}
