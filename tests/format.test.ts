import { describe, expect, it } from 'vitest';
import {
  formatAired,
  formatCompact,
  formatCount,
  formatRuntime,
  formatScore,
  formatViDate,
  formatYears,
  kindLabel,
  malStatusLabel,
  seriesStatusLabel,
} from '../src/content/popover/format';

describe('format numbers', () => {
  it('groups thousands with dots', () => {
    expect(formatCount(560412)).toBe('560.412');
    expect(formatCount(4120)).toBe('4.120');
    expect(formatCount(1234567)).toBe('1.234.567');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1)).toBe('1');
  });

  it('compacts with a comma decimal', () => {
    expect(formatCompact(1_300_000)).toBe('1,3M');
    expect(formatCompact(9_100)).toBe('9,1K');
    expect(formatCompact(1_000)).toBe('1K');
    expect(formatCompact(123_456)).toBe('123K');
    expect(formatCompact(999_600)).toBe('1M');
    expect(formatCompact(12_400_000)).toBe('12M');
    expect(formatCompact(850)).toBe('850');
  });

  it('formats scores per source', () => {
    expect(formatScore({ source: 'mal', value: 9.3 })).toBe('9.30');
    expect(formatScore({ source: 'imdb', value: 7.8 })).toBe('7.8');
    expect(formatScore({ source: 'tmdb', value: 7.604 })).toBe('7.6');
    expect(formatScore({ source: 'rt', value: 88 })).toBe('88%');
    expect(formatScore({ source: 'metacritic', value: 94 })).toBe('94');
  });
});

describe('format time', () => {
  it('formats runtime in hours and minutes', () => {
    expect(formatRuntime(112)).toBe('1 giờ 52 phút');
    expect(formatRuntime(120)).toBe('2 giờ');
    expect(formatRuntime(45)).toBe('45 phút');
  });

  it('formats anime aired ranges from ISO, date and year inputs', () => {
    expect(formatAired({ from: '2023-09-29T00:00:00+00:00', to: '2024-03-22T00:00:00+00:00' }, false)).toBe(
      'Sep 2023 – Mar 2024',
    );
    expect(formatAired({ from: '2021-04-06', to: '2021-06-22' }, false)).toBe('Apr 2021 – Jun 2021');
    expect(formatAired({ from: '2001' }, false)).toBe('2001');
    expect(formatAired({ from: '1999-10-20' }, true)).toBe('Oct 1999 – nay');
    expect(formatAired({ from: '2001-07-20', to: '2001-07-20' }, false)).toBe('Jul 2001');
    expect(formatAired({}, false)).toBeUndefined();
    expect(formatAired({ from: 'soon' }, false)).toBeUndefined();
  });

  it('formats film dates in Vietnamese', () => {
    expect(formatViDate('2022-03-11')).toBe('Tháng 3, 2022');
    expect(formatViDate('2019')).toBe('2019');
    expect(formatViDate(undefined)).toBeUndefined();
  });

  it('formats series years', () => {
    expect(formatYears(2021, 2024, false)).toBe('2021 – 2024');
    expect(formatYears(2023, undefined, true)).toBe('2023 – nay');
    expect(formatYears(2023, 2023, false)).toBe('2023');
    expect(formatYears(undefined, 2024, false)).toBeUndefined();
  });
});

describe('format labels', () => {
  it('labels kinds', () => {
    expect([kindLabel('anime'), kindLabel('movie'), kindLabel('series')]).toEqual(['Anime', 'Phim lẻ', 'Series']);
  });

  it('translates MAL statuses and hides unknown', () => {
    expect(malStatusLabel('Finished Airing')).toBe('Đã chiếu xong');
    expect(malStatusLabel('Currently Airing')).toBe('Đang chiếu');
    expect(malStatusLabel('Not yet aired')).toBe('Chưa chiếu');
    expect(malStatusLabel('Unknown')).toBeUndefined();
  });

  it('translates series statuses', () => {
    expect(seriesStatusLabel('ongoing')).toBe('Đang chiếu');
    expect(seriesStatusLabel('ended')).toBe('Đã kết thúc');
  });
});
