import { describe, expect, it } from 'vitest';
import { normalizeTitle } from '../src/shared/normalize';

describe('normalizeTitle', () => {
  it('lowercases', () => {
    expect(normalizeTitle('Attack On TITAN')).toBe('attack on titan');
  });

  it('turns punctuation into spaces', () => {
    expect(normalizeTitle("Frieren: Beyond Journey's End")).toBe('frieren beyond journey s end');
    expect(normalizeTitle('Re:Zero - Starting Life in Another World')).toBe(
      're zero starting life in another world',
    );
  });

  it('strips diacritics', () => {
    expect(normalizeTitle('Pokémon')).toBe('pokemon');
    expect(normalizeTitle('Die Schöne und das Biest')).toBe('die schone und das biest');
  });

  it('strips Vietnamese diacritics, including đ', () => {
    expect(normalizeTitle('Đảo Hải Tặc')).toBe('dao hai tac');
    expect(normalizeTitle('Thanh Gươm Diệt Quỷ')).toBe('thanh guom diet quy');
  });

  it('keeps Japanese and Korean script', () => {
    expect(normalizeTitle('葬送のフリーレン')).toBe('葬送のフリーレン');
    expect(normalizeTitle('진격의 거인')).toBe('진격의 거인');
    expect(normalizeTitle('ジョジョの奇妙な冒険')).toBe('ジョジョの奇妙な冒険');
    expect(normalizeTitle('バ')).not.toBe(normalizeTitle('ハ'));
  });

  it('folds full-width characters', () => {
    expect(normalizeTitle('ＳＰＹ×ＦＡＭＩＬＹ')).toBe('spy family');
  });

  it('collapses and trims spaces', () => {
    expect(normalizeTitle('  One   Piece \t ')).toBe('one piece');
    expect(normalizeTitle('...')).toBe('');
  });
});
