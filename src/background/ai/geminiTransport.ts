import { AIError } from './AIProvider';
import type { TransportFactory } from './aiCore';
import { httpError, keyOf, parseBody, postJson } from './transportHttp';

function statusError(status: number, body: string): AIError {
  if (status === 401 || status === 403) return new AIError('bad_ai_key');
  if (status === 400 && body.includes('API_KEY_INVALID')) return new AIError('bad_ai_key');
  if (status === 429) return new AIError('rate_limited');
  return httpError(status, body);
}

function readText(body: unknown): string | undefined {
  const parts = (body as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] } | null)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  const texts = parts.flatMap((p) => (typeof p?.text === 'string' ? [p.text] : []));
  return texts.length > 0 ? texts.join('') : undefined;
}

// maxTokens is ignored on purpose: Gemini 2.5 spends the output budget on thinking and a tiny cap returns no text.
export const geminiTransport: TransportFactory = (fetch, config) => async (messages) => {
  const key = keyOf(config);
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const reply = await postJson(
    fetch,
    `${config.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(config.model)}:generateContent`,
    { 'x-goog-api-key': key ?? '' },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    },
  );
  if (!reply.ok) throw statusError(reply.status, reply.text);
  return readText(parseBody(reply.text));
};
