import { describe, expect, it } from 'vitest';

import { addDaysIso, fiscalYearFor, parseIsoDate, toIsoDate, todayIso } from '../lib/dates.js';

describe('fiscalYearFor', () => {
  it('starts a new year in April', () => {
    expect(fiscalYearFor(parseIsoDate('2026-03-31'))).toBe('2025-26');
    expect(fiscalYearFor(parseIsoDate('2026-04-01'))).toBe('2026-27');
  });

  it('labels the January to March tail with the previous start year', () => {
    expect(fiscalYearFor(parseIsoDate('2027-01-15'))).toBe('2026-27');
  });

  it('handles the century change in the label', () => {
    expect(fiscalYearFor(parseIsoDate('2099-05-01'))).toBe('2099-00');
  });
});

describe('parseIsoDate', () => {
  it('parses a valid date at UTC midnight', () => {
    expect(parseIsoDate('2026-10-24').toISOString()).toBe('2026-10-24T00:00:00.000Z');
  });

  it('rejects a date that does not exist', () => {
    expect(() => parseIsoDate('2026-02-30')).toThrow(RangeError);
  });

  it('rejects another format', () => {
    expect(() => parseIsoDate('24-10-2026')).toThrow(RangeError);
  });
});

describe('toIsoDate', () => {
  it('renders the stored calendar date', () => {
    expect(toIsoDate(parseIsoDate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('addDaysIso', () => {
  it('adds days across a month boundary', () => {
    expect(addDaysIso('2026-01-31', 15)).toBe('2026-02-15');
  });

  it('adds days across a year boundary', () => {
    expect(addDaysIso('2026-12-25', 10)).toBe('2027-01-04');
  });

  it('accepts zero days', () => {
    expect(addDaysIso('2026-06-15', 0)).toBe('2026-06-15');
  });
});

describe('todayIso', () => {
  it('returns a plain date string', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('respects the requested time zone', () => {
    // 2026-10-24T19:00Z is already the next day in Kolkata.
    const justBeforeMidnightIst = new Date('2026-10-24T19:00:00.000Z');
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(justBeforeMidnightIst);

    expect(formatted.split('/').reverse().join('-')).toBe('2026-10-25');
  });
});
