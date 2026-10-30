import type { TitleInfo } from './types';

export function needSummary(info: TitleInfo): boolean {
  if (info.kind === 'anime') return true;
  return !info.synopsis?.text.trim() || info.synopsis.lang === 'en';
}
