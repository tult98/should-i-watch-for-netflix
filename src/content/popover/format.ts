import { strings } from '../../shared/i18n';
import type { Kind, Score } from '../../shared/types';

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function oneDecimal(n: number): string {
  return String(Number(n.toFixed(1))).replace('.', ',');
}

export function formatCompact(n: number): string {
  if (n >= 9_995_000) return `${Math.round(n / 1_000_000)}M`;
  if (n >= 999_500) return `${oneDecimal(n / 1_000_000)}M`;
  if (n >= 9_995) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${oneDecimal(n / 1_000)}K`;
  return String(Math.round(n));
}

export function formatScore(score: Score): string {
  switch (score.source) {
    case 'mal':
      return score.value.toFixed(2);
    case 'imdb':
    case 'tmdb':
      return score.value.toFixed(1);
    case 'rt':
      return `${Math.round(score.value)}%`;
    case 'metacritic':
      return String(Math.round(score.value));
  }
}

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return strings.time.minutes(m);
  if (m === 0) return strings.time.hours(h);
  return `${strings.time.hours(h)} ${strings.time.minutes(m)}`;
}

interface YearMonth {
  year: number;
  month?: number;
}

// Reads the date prefix as written so a UTC timestamp never shifts to the previous month locally.
function parseYearMonth(value: string | undefined): YearMonth | undefined {
  const m = value?.trim().match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return undefined;
  const month = m[2] ? Number(m[2]) : undefined;
  return { year: Number(m[1]), month: month && month >= 1 && month <= 12 ? month : undefined };
}

function enMonthYear({ year, month }: YearMonth): string {
  return month ? `${MONTHS_EN[month - 1]} ${year}` : String(year);
}

function range(from: string, to: string | undefined): string {
  if (to === undefined) return `${from} – ${strings.time.untilNow}`;
  return from === to ? from : `${from} – ${to}`;
}

export function formatAired(aired: { from?: string; to?: string }, ongoing: boolean): string | undefined {
  const from = parseYearMonth(aired.from);
  if (!from) return undefined;
  const to = parseYearMonth(aired.to);
  const fromText = enMonthYear(from);
  if (to) return range(fromText, enMonthYear(to));
  return ongoing ? range(fromText, undefined) : fromText;
}

export function formatViDate(value: string | undefined): string | undefined {
  const date = parseYearMonth(value);
  if (!date) return undefined;
  return date.month ? strings.time.month(date.month, date.year) : String(date.year);
}

export function formatYears(start: number | undefined, end: number | undefined, ongoing: boolean): string | undefined {
  if (start === undefined) return undefined;
  if (end !== undefined) return range(String(start), String(end));
  return ongoing ? range(String(start), undefined) : String(start);
}

export function kindLabel(kind: Kind): string {
  return strings.kind[kind];
}

export function malStatusLabel(status: string): string | undefined {
  if (status === '' || status === 'Unknown') return undefined;
  return strings.malStatus[status] ?? status;
}

export function seriesStatusLabel(status: 'ongoing' | 'ended'): string {
  return strings.seriesStatus[status];
}
