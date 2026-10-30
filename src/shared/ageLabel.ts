import { strings } from './strings.vi';

export function ageLabel(year: number | undefined, now: Date): string | undefined {
  if (year === undefined) return undefined;
  const age = now.getFullYear() - year;
  if (age <= 2) return strings.age.new;
  if (age <= 10) return strings.age.recent;
  return strings.age.old;
}
