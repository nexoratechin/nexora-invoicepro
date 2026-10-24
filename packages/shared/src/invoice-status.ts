import type { InvoiceStatus, PaymentState } from './constants.js';

/**
 * Payment state is derived from the money, never stored as the source of truth.
 * A zero total is treated as paid, because there is nothing to collect.
 */
export function derivePaymentState(totalMinor: number, amountPaidMinor: number): PaymentState {
  if (totalMinor < 0 || amountPaidMinor < 0) {
    throw new RangeError('Amounts must not be negative');
  }
  if (amountPaidMinor > totalMinor) {
    throw new RangeError('Paid amount cannot exceed the invoice total');
  }
  if (totalMinor === 0 || amountPaidMinor === totalMinor) {
    return 'paid';
  }

  return amountPaidMinor === 0 ? 'unpaid' : 'partial';
}

/**
 * Overdue is a read-time fact, not a stored status. Dates are compared as
 * YYYY-MM-DD strings, so no time zone can shift the answer.
 */
export function isOverdue(
  dueDate: string,
  balanceDueMinor: number,
  status: InvoiceStatus,
  today: string,
): boolean {
  return status === 'issued' && balanceDueMinor > 0 && dueDate < today;
}

/** The label the UI shows for an invoice. */
export function invoiceDisplayStatus(
  status: InvoiceStatus,
  paymentState: PaymentState,
  overdue: boolean,
): 'draft' | 'void' | 'paid' | 'overdue' | 'partial' | 'unpaid' {
  if (status === 'draft') return 'draft';
  if (status === 'void') return 'void';
  if (paymentState === 'paid') return 'paid';
  if (overdue) return 'overdue';

  return paymentState;
}
