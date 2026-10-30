import type { AIOpinion, Verdict } from '../../shared/types';

export type Validation = { ok: true; opinion: AIOpinion } | { ok: false; error: string };

const VERDICTS: readonly Verdict[] = ['highly_recommended', 'recommended', 'maybe', 'skip'];

function extractObject(text: string): string | null {
  const unfenced = text.replace(/```(?:json)?/gi, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  return start !== -1 && end > start ? unfenced.slice(start, end + 1) : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

export function validateOpinion(text: string): Validation {
  const body = extractObject(text);
  if (body === null) return { ok: false, error: 'no JSON object in the reply' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: 'the reply is not valid JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'the reply is not a JSON object' };
  }
  const { summary_vi, verdict, reason_vi } = parsed as Record<string, unknown>;
  for (const [name, value] of [
    ['summary_vi', summary_vi],
    ['reason_vi', reason_vi],
  ] as const) {
    if (!nonEmpty(value)) return { ok: false, error: `"${name}" must be a non-empty string` };
  }
  if (typeof verdict !== 'string' || !VERDICTS.includes(verdict as Verdict)) {
    return { ok: false, error: `"verdict" must be one of ${VERDICTS.join(', ')}` };
  }
  return {
    ok: true,
    opinion: {
      summary_vi: (summary_vi as string).trim(),
      verdict: verdict as Verdict,
      reason_vi: (reason_vi as string).trim(),
    },
  };
}
