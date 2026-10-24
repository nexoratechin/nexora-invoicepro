import { describe, expect, it } from 'vitest';

import { addDaysIso, formatDate, money, toQuantityInput, toRupeeInput } from './format';
import { previewTotals } from './invoice';
import type { InvoiceLineFormValues } from './validation';

const lines: InvoiceLineFormValues[] = [
  {
    productId: '',
    description: 'Website redesign',
    hsnSac: '',
    unitLabel: 'project',
    quantity: '1',
    unitPrice: '25000.00',
    discountPercent: '0',
    taxRateBp: '1800',
  },
  {
    productId: '',
    description: 'Hosting',
    hsnSac: '',
    unitLabel: 'month',
    quantity: '12',
    unitPrice: '500.00',
    discountPercent: '5',
    taxRateBp: '1800',
  },
];

describe('money formatting', () => {
  it('groups rupees the Indian way', () => {
    expect(money(1_234_567_890)).toBe('₹1,23,45,678.90');
    expect(money(100)).toBe('₹1.00');
    expect(money(0)).toBe('₹0.00');
  });

  it('renders paise back into a rupee input', () => {
    expect(toRupeeInput(2_500_000)).toBe('25000.00');
    expect(toRupeeInput(5)).toBe('0.05');
  });

  it('renders quantities without trailing zeros', () => {
    expect(toQuantityInput(1500)).toBe('1.5');
    expect(toQuantityInput(1000)).toBe('1');
    expect(toQuantityInput(1250)).toBe('1.25');
  });
});

describe('dates', () => {
  it('formats a calendar date without shifting it', () => {
    expect(formatDate('2026-10-24')).toBe('24 Oct 2026');
  });

  it('adds days across a month boundary', () => {
    expect(addDaysIso('2026-01-31', 15)).toBe('2026-02-15');
  });
});

describe('invoice preview', () => {
  it('matches the server totals for the same lines', () => {
    const preview = previewTotals(lines, '24', '24');

    expect(preview).not.toBeNull();
    expect(preview?.taxTreatment).toBe('intra');
    expect(preview?.totals.subtotalMinor).toBe(3_100_000);
    expect(preview?.totals.discountTotalMinor).toBe(30_000);
    expect(preview?.totals.taxableTotalMinor).toBe(3_070_000);
    expect(preview?.totals.cgstTotalMinor).toBe(276_300);
    expect(preview?.totals.sgstTotalMinor).toBe(276_300);
    expect(preview?.totals.totalMinor).toBe(3_622_600);
  });

  it('uses IGST when the place of supply differs', () => {
    const preview = previewTotals(lines, '24', '27');

    expect(preview?.taxTreatment).toBe('inter');
    expect(preview?.totals.igstTotalMinor).toBe(552_600);
    expect(preview?.totals.cgstTotalMinor).toBe(0);
  });

  it('returns null instead of throwing on an incomplete line', () => {
    const broken = [{ ...lines[0]!, unitPrice: 'abc' }];

    expect(previewTotals(broken, '24', '24')).toBeNull();
  });
});
