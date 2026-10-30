import { describe, expect, it } from 'vitest';
import { ageLabel } from '../src/shared/ageLabel';

const now = new Date(2026, 9, 31);

describe('ageLabel', () => {
  it('is Mới up to two years old, including future years', () => {
    expect(ageLabel(2026, now)).toBe('Mới');
    expect(ageLabel(2024, now)).toBe('Mới');
    expect(ageLabel(2027, now)).toBe('Mới');
  });

  it('is Vài năm trước from three to ten years old', () => {
    expect(ageLabel(2023, now)).toBe('Vài năm trước');
    expect(ageLabel(2016, now)).toBe('Vài năm trước');
  });

  it('is Cũ/kinh điển past ten years', () => {
    expect(ageLabel(2015, now)).toBe('Cũ/kinh điển');
    expect(ageLabel(1988, now)).toBe('Cũ/kinh điển');
  });

  it('is undefined without a year', () => {
    expect(ageLabel(undefined, now)).toBeUndefined();
  });
});
