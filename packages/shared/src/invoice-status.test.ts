import { describe, expect, it } from 'vitest';

import { derivePaymentState, invoiceDisplayStatus, isOverdue } from './invoice-status.js';

describe('derivePaymentState', () => {
  it('is unpaid with no money received', () => {
    expect(derivePaymentState(1000, 0)).toBe('unpaid');
  });

  it('is partial when some money is received', () => {
    expect(derivePaymentState(1000, 400)).toBe('partial');
  });

  it('is paid when the balance is zero', () => {
    expect(derivePaymentState(1000, 1000)).toBe('paid');
  });

  it('is paid for a zero value invoice', () => {
    expect(derivePaymentState(0, 0)).toBe('paid');
  });

  it('rejects an overpayment', () => {
    expect(() => derivePaymentState(1000, 1001)).toThrow(RangeError);
  });

  it('rejects negatives', () => {
    expect(() => derivePaymentState(-1, 0)).toThrow(RangeError);
  });
});

describe('isOverdue', () => {
  it('is overdue after the due date with a balance', () => {
    expect(isOverdue('2026-10-01', 500, 'issued', '2026-10-24')).toBe(true);
  });

  it('is not overdue on the due date itself', () => {
    expect(isOverdue('2026-10-24', 500, 'issued', '2026-10-24')).toBe(false);
  });

  it('is not overdue with no balance', () => {
    expect(isOverdue('2026-10-01', 0, 'issued', '2026-10-24')).toBe(false);
  });

  it('is not overdue while still a draft', () => {
    expect(isOverdue('2026-10-01', 500, 'draft', '2026-10-24')).toBe(false);
  });

  it('is not overdue once void', () => {
    expect(isOverdue('2026-10-01', 500, 'void', '2026-10-24')).toBe(false);
  });
});

describe('invoiceDisplayStatus', () => {
  it('shows the workflow status while a draft', () => {
    expect(invoiceDisplayStatus('draft', 'unpaid', true)).toBe('draft');
  });

  it('shows paid ahead of overdue', () => {
    expect(invoiceDisplayStatus('issued', 'paid', true)).toBe('paid');
  });

  it('shows overdue ahead of unpaid and partial', () => {
    expect(invoiceDisplayStatus('issued', 'unpaid', true)).toBe('overdue');
    expect(invoiceDisplayStatus('issued', 'partial', true)).toBe('overdue');
  });

  it('falls back to the payment state', () => {
    expect(invoiceDisplayStatus('issued', 'partial', false)).toBe('partial');
    expect(invoiceDisplayStatus('issued', 'unpaid', false)).toBe('unpaid');
  });
});
