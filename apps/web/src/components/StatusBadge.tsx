import { invoiceDisplayStatus, type InvoiceStatus, type PaymentState } from '@nexora/shared';

import { Badge } from './ui';

const labels = {
  draft: 'Draft',
  void: 'Void',
  paid: 'Paid',
  overdue: 'Overdue',
  partial: 'Part paid',
  unpaid: 'Unpaid',
} as const;

const tones = {
  draft: 'neutral',
  void: 'neutral',
  paid: 'green',
  overdue: 'red',
  partial: 'blue',
  unpaid: 'amber',
} as const;

export function InvoiceStatusBadge({
  status,
  paymentState,
  overdue,
}: {
  status: InvoiceStatus;
  paymentState: PaymentState;
  overdue: boolean;
}) {
  const display = invoiceDisplayStatus(status, paymentState, overdue);

  return <Badge tone={tones[display]}>{labels[display]}</Badge>;
}
