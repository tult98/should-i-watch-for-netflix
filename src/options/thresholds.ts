import { strings } from '../shared/strings.vi';
import type { ThresholdSet, Thresholds } from '../shared/types';

const t = strings.options;
const e = t.thresholdErrors;

export type SetKey = keyof Thresholds;
export type FieldKey = 'highlyScore' | 'highlyVotes' | 'rankMax' | 'recommendedScore' | 'recommendedVotes' | 'maybeScore' | 'lowVotesBelow';
export type RowKey = 'highly' | 'recommended' | 'maybe' | 'warn';

export interface ThresholdField {
  key: FieldKey;
  label: string;
  kind: 'score' | 'count';
  optional?: boolean;
}

export interface ThresholdRow {
  row: RowKey;
  fields: ThresholdField[];
}

export const SET_KEYS: readonly SetKey[] = ['mal', 'imdb', 'tmdb'];

export function thresholdRows(set: SetKey): ThresholdRow[] {
  const anime = set === 'mal';
  const votesAtLeast = anime ? t.animeVotesAtLeast : t.filmVotesAtLeast;
  const highly: ThresholdField[] = [
    { key: 'highlyScore', label: t.scoreAtLeast, kind: 'score' },
    { key: 'highlyVotes', label: votesAtLeast, kind: 'count' },
  ];
  if (anime) highly.push({ key: 'rankMax', label: t.rankAtMost, kind: 'count', optional: true });
  return [
    { row: 'highly', fields: highly },
    {
      row: 'recommended',
      fields: [
        { key: 'recommendedScore', label: t.scoreAtLeast, kind: 'score' },
        { key: 'recommendedVotes', label: votesAtLeast, kind: 'count' },
      ],
    },
    { row: 'maybe', fields: [{ key: 'maybeScore', label: t.scoreAtLeast, kind: 'score' }] },
    {
      row: 'warn',
      fields: [{ key: 'lowVotesBelow', label: anime ? t.animeVotesBelow : t.filmVotesBelow, kind: 'count' }],
    },
  ];
}

export type FormValues = Partial<Record<FieldKey, string>>;

function score(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

export function thresholdFormValues(set: ThresholdSet): FormValues {
  return {
    highlyScore: score(set.highly.score),
    highlyVotes: String(set.highly.votes),
    rankMax: set.highly.rankMax !== undefined ? String(set.highly.rankMax) : '',
    recommendedScore: score(set.recommended.score),
    recommendedVotes: String(set.recommended.votes),
    maybeScore: score(set.maybe.score),
    lowVotesBelow: String(set.lowVotesBelow),
  };
}

export interface FieldError {
  key: FieldKey;
  message: string;
}

export type ParseResult = { ok: true; value: ThresholdSet } | { ok: false; errors: FieldError[] };

const DECIMAL = /^\d+(\.\d+)?$/;
const INTEGER = /^\d+$/;

export function rowLabel(row: RowKey): string {
  if (row === 'highly') return strings.verdict.highly_recommended;
  if (row === 'recommended') return strings.verdict.recommended;
  if (row === 'maybe') return strings.verdict.maybe;
  return t.warnBadge;
}

function parseField(row: RowKey, field: ThresholdField, raw: string | undefined): number | undefined | FieldError {
  const label = `${rowLabel(row)}, ${field.label}`;
  const fail = (message: (label: string) => string): FieldError => ({ key: field.key, message: message(label) });
  const text = (raw ?? '').trim();
  if (text === '') return field.optional ? undefined : fail(e.required);
  if (field.kind === 'count') {
    if (INTEGER.test(text)) return Number(text);
    return fail(DECIMAL.test(text) ? e.notInteger : e.notNumber);
  }
  if (!DECIMAL.test(text)) return fail(e.notNumber);
  const value = Number(text);
  return value <= 10 ? value : fail(e.scoreRange);
}

export function parseThresholdForm(set: SetKey, values: FormValues): ParseResult {
  const parsed: Partial<Record<FieldKey, number>> = {};
  const errors: FieldError[] = [];
  for (const { row, fields } of thresholdRows(set)) {
    for (const field of fields) {
      const result = parseField(row, field, values[field.key]);
      if (typeof result === 'object') errors.push(result);
      else if (result !== undefined) parsed[field.key] = result;
    }
  }
  if (errors.length) return { ok: false, errors };
  const n = (key: FieldKey) => parsed[key] as number;
  const highly: ThresholdSet['highly'] = { score: n('highlyScore'), votes: n('highlyVotes') };
  if (parsed.rankMax !== undefined) highly.rankMax = parsed.rankMax;
  return {
    ok: true,
    value: {
      highly,
      recommended: { score: n('recommendedScore'), votes: n('recommendedVotes') },
      maybe: { score: n('maybeScore') },
      lowVotesBelow: n('lowVotesBelow'),
    },
  };
}
