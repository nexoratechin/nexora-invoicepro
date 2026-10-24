import { describe, expect, it } from 'vitest';

import {
  applyBasisPoints,
  formatPaise,
  formatPaisePlain,
  MoneyError,
  multiplyByQuantity,
  parseRupeeAmount,
  paiseToRupees,
  roundHalfUp,
  roundHalfUpDiv,
  sumMinor,
} from './money.js';

describe('roundHalfUp', () => {
  it('rounds half away from zero', () => {
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(7, 2)).toBe(4);
    expect(roundHalfUp(-5, 2)).toBe(-3);
    expect(roundHalfUp(-7, 2)).toBe(-4);
  });

  it('rounds below half down', () => {
    expect(roundHalfUp(4, 3)).toBe(1);
    expect(roundHalfUp(-4, 3)).toBe(-1);
    expect(roundHalfUp(1, 3)).toBe(0);
  });

  it('handles negative denominators', () => {
    expect(roundHalfUpDiv(7n, -2n)).toBe(-4n);
    expect(roundHalfUpDiv(-7n, -2n)).toBe(4n);
  });

  it('rejects division by zero', () => {
    expect(() => roundHalfUpDiv(1n, 0n)).toThrow(MoneyError);
  });
});

describe('applyBasisPoints', () => {
  it('applies 18 percent to one hundred paise', () => {
    expect(applyBasisPoints(100, 1800)).toBe(18);
  });

  it('rounds a fraction of a paisa up', () => {
    // 999 * 0.18 = 179.82
    expect(applyBasisPoints(999, 1800)).toBe(180);
  });

  it('rounds a tiny fraction down', () => {
    // 1 * 0.18 = 0.18
    expect(applyBasisPoints(1, 1800)).toBe(0);
    // 3 * 0.18 = 0.54
    expect(applyBasisPoints(3, 1800)).toBe(1);
  });

  it('returns zero for a zero rate', () => {
    expect(applyBasisPoints(123456, 0)).toBe(0);
  });

  it('applies a fractional rate', () => {
    // 2.5 percent of 10000 paise is 250
    expect(applyBasisPoints(10_000, 250)).toBe(250);
  });
});

describe('multiplyByQuantity', () => {
  it('handles a whole quantity', () => {
    expect(multiplyByQuantity(2_500_000, 1000)).toBe(2_500_000);
  });

  it('handles twelve units', () => {
    expect(multiplyByQuantity(50_000, 12_000)).toBe(600_000);
  });

  it('handles one and a half units', () => {
    expect(multiplyByQuantity(100, 1500)).toBe(150);
  });

  it('rounds the product of three decimals', () => {
    // 333 * 3.333 = 1109.889
    expect(multiplyByQuantity(333, 3333)).toBe(1110);
  });

  it('accepts the largest documented inputs without losing precision', () => {
    expect(multiplyByQuantity(100_000_000_000, 1_000_000)).toBe(100_000_000_000_000);
  });
});

describe('sumMinor', () => {
  it('adds values', () => {
    expect(sumMinor([1, 2, 3])).toBe(6);
    expect(sumMinor([])).toBe(0);
  });

  it('throws instead of losing precision on overflow', () => {
    expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow(MoneyError);
  });

  it('throws on a non integer input', () => {
    expect(() => sumMinor([1.5])).toThrow(MoneyError);
  });
});

describe('parseRupeeAmount', () => {
  it('parses whole and decimal amounts', () => {
    expect(parseRupeeAmount('1250.50')).toBe(125_050);
    expect(parseRupeeAmount('1250.5')).toBe(125_050);
    expect(parseRupeeAmount('1250')).toBe(125_000);
    expect(parseRupeeAmount('0.05')).toBe(5);
    expect(parseRupeeAmount('0.5')).toBe(50);
  });

  it('accepts thousands separators and whitespace', () => {
    expect(parseRupeeAmount(' 1,250.50 ')).toBe(125_050);
  });

  it('parses negatives', () => {
    expect(parseRupeeAmount('-10.25')).toBe(-1025);
  });

  it('rejects more than two decimals', () => {
    expect(() => parseRupeeAmount('1.234')).toThrow(MoneyError);
  });

  it('rejects letters and empty input', () => {
    expect(() => parseRupeeAmount('abc')).toThrow(MoneyError);
    expect(() => parseRupeeAmount('')).toThrow(MoneyError);
  });
});

describe('formatPaise', () => {
  it('groups in the Indian pattern', () => {
    expect(formatPaise(1_234_567_890)).toBe('₹1,23,45,678.90');
    expect(formatPaise(10_000_000)).toBe('₹1,00,000.00');
    expect(formatPaise(100_000)).toBe('₹1,000.00');
  });

  it('pads paise to two digits', () => {
    expect(formatPaise(5)).toBe('₹0.05');
    expect(formatPaise(100)).toBe('₹1.00');
    expect(formatPaise(0)).toBe('₹0.00');
  });

  it('puts the sign before the symbol', () => {
    expect(formatPaise(-12_345)).toBe('-₹123.45');
  });

  it('can omit the symbol', () => {
    expect(formatPaisePlain(12_345)).toBe('123.45');
  });
});

describe('paiseToRupees', () => {
  it('converts for display', () => {
    expect(paiseToRupees(150)).toBe(1.5);
  });
});
