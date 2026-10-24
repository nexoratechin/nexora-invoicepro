import { describe, expect, it } from 'vitest';

import { MoneyError } from './money.js';
import {
  computeInvoice,
  computeInvoiceTotals,
  computeLineItem,
  resolveTaxTreatment,
  type LineItemInput,
} from './tax.js';

const website: LineItemInput = {
  description: 'Website redesign, 5 pages',
  quantityMilli: 1000,
  unitPriceMinor: 2_500_000,
  taxRateBp: 1800,
};

describe('resolveTaxTreatment', () => {
  it('is intra state when the place of supply matches the business state', () => {
    expect(resolveTaxTreatment('24', '24')).toBe('intra');
  });

  it('is inter state when they differ', () => {
    expect(resolveTaxTreatment('24', '27')).toBe('inter');
  });
});

describe('computeLineItem', () => {
  it('splits 18 percent into equal CGST and SGST within the state', () => {
    const line = computeLineItem(website, 'intra');

    expect(line.grossMinor).toBe(2_500_000);
    expect(line.discountMinor).toBe(0);
    expect(line.taxableMinor).toBe(2_500_000);
    expect(line.taxMinor).toBe(450_000);
    expect(line.cgstMinor).toBe(225_000);
    expect(line.sgstMinor).toBe(225_000);
    expect(line.igstMinor).toBe(0);
    expect(line.lineTotalMinor).toBe(2_950_000);
  });

  it('charges the whole tax as IGST across states', () => {
    const line = computeLineItem(website, 'inter');

    expect(line.taxMinor).toBe(450_000);
    expect(line.cgstMinor).toBe(0);
    expect(line.sgstMinor).toBe(0);
    expect(line.igstMinor).toBe(450_000);
    expect(line.lineTotalMinor).toBe(2_950_000);
  });

  it('gives the extra paisa to CGST when the tax is odd', () => {
    const line = computeLineItem(
      { description: 'Half rupee item', quantityMilli: 1000, unitPriceMinor: 100, taxRateBp: 500 },
      'intra',
    );

    expect(line.taxMinor).toBe(5);
    expect(line.cgstMinor).toBe(3);
    expect(line.sgstMinor).toBe(2);
    expect(line.cgstMinor + line.sgstMinor).toBe(line.taxMinor);
  });

  it('applies the discount before tax', () => {
    const line = computeLineItem(
      {
        description: 'Discounted service',
        quantityMilli: 1000,
        unitPriceMinor: 10_000,
        discountBp: 1000,
        taxRateBp: 1800,
      },
      'intra',
    );

    expect(line.grossMinor).toBe(10_000);
    expect(line.discountMinor).toBe(1000);
    expect(line.taxableMinor).toBe(9000);
    expect(line.taxMinor).toBe(1620);
    expect(line.lineTotalMinor).toBe(10_620);
  });

  it('never discounts below zero', () => {
    const line = computeLineItem(
      {
        description: 'Fully discounted',
        quantityMilli: 1000,
        unitPriceMinor: 5000,
        discountBp: 10_000,
        taxRateBp: 1800,
      },
      'intra',
    );

    expect(line.discountMinor).toBe(5000);
    expect(line.taxableMinor).toBe(0);
    expect(line.taxMinor).toBe(0);
    expect(line.lineTotalMinor).toBe(0);
  });

  it('handles a zero rate slab', () => {
    const line = computeLineItem(
      { description: 'Exempt service', quantityMilli: 2000, unitPriceMinor: 75_000, taxRateBp: 0 },
      'intra',
    );

    expect(line.grossMinor).toBe(150_000);
    expect(line.taxMinor).toBe(0);
    expect(line.cgstMinor).toBe(0);
    expect(line.lineTotalMinor).toBe(150_000);
  });

  it('rounds a half paisa of tax up', () => {
    const line = computeLineItem(
      { description: 'Rounding edge', quantityMilli: 1000, unitPriceMinor: 1, taxRateBp: 5000 },
      'intra',
    );

    expect(line.taxMinor).toBe(1);
  });

  it('handles a fractional quantity', () => {
    const line = computeLineItem(
      { description: 'Consulting', quantityMilli: 1500, unitPriceMinor: 100_000, taxRateBp: 1800 },
      'intra',
    );

    expect(line.grossMinor).toBe(150_000);
    expect(line.taxMinor).toBe(27_000);
  });

  it('keeps every line component an integer', () => {
    const line = computeLineItem(
      { description: 'Odd numbers', quantityMilli: 3333, unitPriceMinor: 3333, taxRateBp: 1200 },
      'intra',
    );

    for (const value of Object.values(line)) {
      if (typeof value === 'number') {
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('rejects an empty description', () => {
    expect(() => computeLineItem({ ...website, description: '   ' }, 'intra')).toThrow(MoneyError);
  });

  it('rejects a zero quantity', () => {
    expect(() => computeLineItem({ ...website, quantityMilli: 0 }, 'intra')).toThrow(MoneyError);
  });

  it('rejects a negative price', () => {
    expect(() => computeLineItem({ ...website, unitPriceMinor: -1 }, 'intra')).toThrow(MoneyError);
  });

  it('rejects a tax rate above 100 percent', () => {
    expect(() => computeLineItem({ ...website, taxRateBp: 10_001 }, 'intra')).toThrow(MoneyError);
  });
});

describe('computeInvoiceTotals', () => {
  it('adds up the lines without rounding again', () => {
    const first = computeLineItem(website, 'intra');
    const second = computeLineItem(
      {
        description: 'Hosting, 12 months',
        quantityMilli: 12_000,
        unitPriceMinor: 50_000,
        discountBp: 500,
        taxRateBp: 1800,
      },
      'intra',
    );

    const totals = computeInvoiceTotals([first, second]);

    expect(totals.subtotalMinor).toBe(3_100_000);
    expect(totals.discountTotalMinor).toBe(30_000);
    expect(totals.taxableTotalMinor).toBe(3_070_000);
    expect(totals.taxTotalMinor).toBe(552_600);
    expect(totals.totalMinor).toBe(3_622_600);
    expect(totals.totalMinor).toBe(first.lineTotalMinor + second.lineTotalMinor);
  });

  it('keeps the tax split consistent', () => {
    const lines = [
      computeLineItem(website, 'intra'),
      computeLineItem({ ...website, taxRateBp: 500 }, 'intra'),
      computeLineItem({ ...website, quantityMilli: 1500 }, 'intra'),
    ];
    const totals = computeInvoiceTotals(lines);

    expect(totals.cgstTotalMinor + totals.sgstTotalMinor + totals.igstTotalMinor).toBe(
      totals.taxTotalMinor,
    );
    expect(totals.taxableTotalMinor + totals.taxTotalMinor).toBe(totals.totalMinor);
  });

  it('returns zeros for an empty set', () => {
    const totals = computeInvoiceTotals([]);

    expect(totals.totalMinor).toBe(0);
    expect(totals.taxTotalMinor).toBe(0);
  });
});

describe('computeInvoice', () => {
  it('returns lines with sequence numbers and reconciled totals', () => {
    const { lines, totals } = computeInvoice(
      [website, { ...website, description: 'Support retainer' }],
      'inter',
    );

    expect(lines.map((line) => line.lineNo)).toEqual([1, 2]);
    expect(totals.igstTotalMinor).toBe(900_000);
    expect(totals.cgstTotalMinor).toBe(0);
    expect(totals.totalMinor).toBe(5_900_000);
  });

  it('rejects an invoice with no lines', () => {
    expect(() => computeInvoice([], 'intra')).toThrow(MoneyError);
  });
});
