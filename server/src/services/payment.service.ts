import { Types } from 'mongoose';

import { formatPaise } from '@nexora/shared';

import {
  InvoiceModel,
  PaymentModel,
  type InvoiceEvent,
  type PaymentDocument,
} from '../models/index.js';
import { AppError, conflict, notFound } from '../lib/errors.js';
import { escapeRegex, paginated, parseSort, toPage } from '../schemas/common.schemas.js';
import type { Paginated } from '../schemas/common.schemas.js';
import type { ListPaymentsQuery, RecordPaymentInput } from '../schemas/payment.schemas.js';

const SORTABLE = ['paidAt', 'amountMinor', 'createdAt'] as const;

export interface RecordPaymentResult {
  payment: object;
  invoice: object | null;
  created: boolean;
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11_000
  );
}

/**
 * Recording a payment takes two writes that cannot be one transaction without a
 * replica set: the payment row, and the invoice balance. The payment row is
 * written first so the unique index on clientRequestId owns idempotency, then
 * the invoice balance moves with a single conditional update. If that condition
 * fails, the payment row is removed and the caller gets a 409.
 */
export async function recordPayment(
  businessId: Types.ObjectId,
  actorUserId: Types.ObjectId,
  invoiceId: string,
  idempotencyKey: string | undefined,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  if (idempotencyKey === undefined || idempotencyKey.trim().length < 8) {
    throw new AppError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Send an Idempotency-Key header of at least 8 characters so a retry cannot double charge',
    );
  }

  const clientRequestId = idempotencyKey.trim();

  const existing = await PaymentModel.findOne({ businessId, clientRequestId }).exec();

  if (existing !== null) {
    return { payment: existing.toJSON(), invoice: null, created: false };
  }

  const invoice = await InvoiceModel.findOne({ _id: invoiceId, businessId }).exec();

  if (invoice === null) {
    throw notFound('Invoice');
  }

  if (invoice.status !== 'issued') {
    throw conflict('CONFLICT', 'Only an issued invoice can take a payment');
  }

  if (input.amountMinor > invoice.balanceDueMinor) {
    throw conflict(
      'INSUFFICIENT_BALANCE',
      `The balance on this invoice is ${formatPaise(invoice.balanceDueMinor)}`,
      { balanceDueMinor: invoice.balanceDueMinor },
    );
  }

  let payment: PaymentDocument;

  try {
    payment = await PaymentModel.create({
      businessId,
      invoiceId: invoice._id,
      customerId: invoice.customerId,
      amountMinor: input.amountMinor,
      paidAt: new Date(`${input.paidAt}T00:00:00.000Z`),
      method: input.method,
      reference: input.reference,
      note: input.note,
      clientRequestId,
      recordedByUserId: actorUserId,
      status: 'active',
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      const racer = await PaymentModel.findOne({ businessId, clientRequestId }).exec();

      if (racer !== null) {
        return { payment: racer.toJSON(), invoice: null, created: false };
      }
    }

    throw error;
  }

  const amount = input.amountMinor;
  const event: InvoiceEvent = {
    type: 'payment',
    message: `Payment of ${formatPaise(amount)} recorded`,
    actorUserId,
    createdAt: new Date(),
  };

  const updated = await InvoiceModel.findOneAndUpdate(
    {
      _id: invoice._id,
      businessId,
      status: 'issued',
      balanceDueMinor: { $gte: amount },
    },
    [
      {
        $set: {
          amountPaidMinor: { $add: ['$amountPaidMinor', amount] },
          balanceDueMinor: { $subtract: ['$balanceDueMinor', amount] },
        },
      },
      {
        $set: {
          paymentState: {
            $cond: [{ $lte: ['$balanceDueMinor', 0] }, 'paid', 'partial'],
          },
          events: { $concatArrays: ['$events', [event]] },
          updatedAt: '$$NOW',
        },
      },
    ],
    { returnDocument: 'after', timestamps: false, updatePipeline: true },
  ).exec();

  if (updated === null) {
    // The balance moved under us, so this payment was never counted. Remove it
    // rather than leave a payment row that the invoice does not reflect.
    await PaymentModel.deleteOne({ _id: payment._id, businessId }).exec();

    const current = await InvoiceModel.findOne({ _id: invoice._id, businessId })
      .select('balanceDueMinor')
      .exec();

    throw conflict(
      'INSUFFICIENT_BALANCE',
      `The balance on this invoice is now ${formatPaise(current?.balanceDueMinor ?? 0)}`,
      { balanceDueMinor: current?.balanceDueMinor ?? 0 },
    );
  }

  return {
    payment: payment.toJSON(),
    invoice: updated.toJSON(),
    created: true,
  };
}

export async function voidPayment(
  businessId: Types.ObjectId,
  actorUserId: Types.ObjectId,
  paymentId: string,
  reason: string,
): Promise<object> {
  const payment = await PaymentModel.findOne({ _id: paymentId, businessId }).exec();

  if (payment === null) {
    throw notFound('Payment');
  }

  if (payment.status === 'void') {
    throw conflict('CONFLICT', 'This payment is already void');
  }

  const now = new Date();

  const voided = await PaymentModel.findOneAndUpdate(
    { _id: payment._id, businessId, status: 'active' },
    { $set: { status: 'void', voidReason: reason, voidedAt: now } },
    { returnDocument: 'after' },
  ).exec();

  if (voided === null) {
    throw conflict('CONFLICT', 'This payment was already voided');
  }

  const event: InvoiceEvent = {
    type: 'payment',
    message: `Payment of ${formatPaise(payment.amountMinor)} voided: ${reason}`,
    actorUserId,
    createdAt: now,
  };

  const updated = await InvoiceModel.findOneAndUpdate(
    { _id: payment.invoiceId, businessId },
    [
      {
        $set: {
          amountPaidMinor: { $subtract: ['$amountPaidMinor', payment.amountMinor] },
          balanceDueMinor: { $add: ['$balanceDueMinor', payment.amountMinor] },
        },
      },
      {
        $set: {
          paymentState: {
            $cond: [
              { $lte: ['$amountPaidMinor', 0] },
              'unpaid',
              { $cond: [{ $lte: ['$balanceDueMinor', 0] }, 'paid', 'partial'] },
            ],
          },
          events: { $concatArrays: ['$events', [event]] },
          updatedAt: '$$NOW',
        },
      },
    ],
    { returnDocument: 'after', timestamps: false, updatePipeline: true },
  ).exec();

  return {
    payment: voided.toJSON(),
    invoice: updated === null ? null : updated.toJSON(),
  };
}

export async function listPayments(
  businessId: Types.ObjectId,
  query: ListPaymentsQuery,
): Promise<Paginated<object>> {
  const page = toPage(query);
  const filter: Record<string, unknown> = { businessId };

  if (query.invoiceId !== undefined) {
    filter.invoiceId = new Types.ObjectId(query.invoiceId);
  }

  if (query.customerId !== undefined) {
    filter.customerId = new Types.ObjectId(query.customerId);
  }

  if (query.method !== undefined) {
    filter.method = query.method;
  }

  if (query.status !== undefined) {
    filter.status = query.status;
  }

  if (query.from !== undefined || query.to !== undefined) {
    filter.paidAt = {
      ...(query.from === undefined ? {} : { $gte: new Date(`${query.from}T00:00:00.000Z`) }),
      ...(query.to === undefined ? {} : { $lte: new Date(`${query.to}T23:59:59.999Z`) }),
    };
  }

  if (query.q !== undefined && query.q.length > 0) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ reference: pattern }, { note: pattern }];
  }

  const [items, total] = await Promise.all([
    PaymentModel.find(filter)
      .sort(parseSort(query.sort, SORTABLE, '-paidAt'))
      .skip(page.skip)
      .limit(page.limit)
      .populate('invoiceId', 'invoiceNumber')
      .exec(),
    PaymentModel.countDocuments(filter).exec(),
  ]);

  return paginated(
    items.map((item) => item.toJSON()),
    total,
    page,
  );
}

export async function getPayment(businessId: Types.ObjectId, paymentId: string): Promise<object> {
  const payment = await PaymentModel.findOne({ _id: paymentId, businessId }).exec();

  if (payment === null) {
    throw notFound('Payment');
  }

  return payment.toJSON();
}

export async function listInvoicePayments(
  businessId: Types.ObjectId,
  invoiceId: string,
): Promise<object[]> {
  const invoice = await InvoiceModel.findOne({ _id: invoiceId, businessId }).select('_id').exec();

  if (invoice === null) {
    throw notFound('Invoice');
  }

  const payments = await PaymentModel.find({ businessId, invoiceId: invoice._id })
    .sort({ paidAt: -1 })
    .exec();

  return payments.map((payment) => payment.toJSON());
}
