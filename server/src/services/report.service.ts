import { Types } from 'mongoose';

import { InvoiceModel, PaymentModel } from '../models/index.js';
import { parseIsoDate, todayIso } from '../lib/dates.js';

export interface DateRange {
  from: string;
  to: string;
}

function monthStart(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

function resolveRange(from?: string, to?: string): DateRange {
  const today = todayIso();

  return {
    from: from ?? monthStart(today),
    to: to ?? today,
  };
}

function dateMatch(range: DateRange): { $gte: Date; $lte: Date } {
  return { $gte: parseIsoDate(range.from), $lte: parseIsoDate(range.to) };
}

export interface DashboardCounts {
  total: number;
  paid: number;
  unpaid: number;
  partial: number;
  overdue: number;
  draft: number;
  void: number;
}

export interface DashboardRevenue {
  billedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  overdueMinor: number;
}

export interface DashboardResult {
  range: DateRange;
  counts: DashboardCounts;
  revenue: DashboardRevenue;
  recentInvoices: object[];
  overdueInvoices: object[];
}

interface CountRow {
  _id: { status: string; paymentState: string };
  count: number;
}

export async function getDashboard(
  businessId: Types.ObjectId,
  from?: string,
  to?: string,
): Promise<DashboardResult> {
  const range = resolveRange(from, to);
  const today = parseIsoDate(todayIso());
  const business = new Types.ObjectId(businessId);

  const [countRows, revenueRows, overdueRows, recent, overdueInvoices] = await Promise.all([
    InvoiceModel.aggregate<CountRow>([
      { $match: { businessId: business, invoiceDate: dateMatch(range) } },
      { $group: { _id: { status: '$status', paymentState: '$paymentState' }, count: { $sum: 1 } } },
    ]),
    InvoiceModel.aggregate<{
      billedMinor: number;
      collectedMinor: number;
      outstandingMinor: number;
    }>([
      {
        $match: {
          businessId: business,
          status: 'issued',
          invoiceDate: dateMatch(range),
        },
      },
      {
        $group: {
          _id: null,
          billedMinor: { $sum: '$totals.totalMinor' },
          collectedMinor: { $sum: '$amountPaidMinor' },
          outstandingMinor: { $sum: '$balanceDueMinor' },
        },
      },
    ]),
    InvoiceModel.aggregate<{ count: number; overdueMinor: number }>([
      {
        $match: {
          businessId: business,
          status: 'issued',
          balanceDueMinor: { $gt: 0 },
          dueDate: { $lt: today },
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, overdueMinor: { $sum: '$balanceDueMinor' } } },
    ]),
    InvoiceModel.find({ businessId, status: { $ne: 'void' }, invoiceDate: dateMatch(range) })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('customerId', 'name')
      .exec(),
    InvoiceModel.find({
      businessId,
      status: 'issued',
      balanceDueMinor: { $gt: 0 },
      dueDate: { $lt: today },
    })
      .sort({ dueDate: 1 })
      .limit(5)
      .populate('customerId', 'name')
      .exec(),
  ]);

  const counts: DashboardCounts = {
    total: 0,
    paid: 0,
    unpaid: 0,
    partial: 0,
    overdue: overdueRows[0]?.count ?? 0,
    draft: 0,
    void: 0,
  };

  for (const row of countRows) {
    if (row._id.status === 'draft') {
      counts.draft += row.count;
    } else if (row._id.status === 'void') {
      counts.void += row.count;
    } else {
      counts.total += row.count;

      if (row._id.paymentState === 'paid') counts.paid += row.count;
      if (row._id.paymentState === 'unpaid') counts.unpaid += row.count;
      if (row._id.paymentState === 'partial') counts.partial += row.count;
    }
  }

  return {
    range,
    counts,
    revenue: {
      billedMinor: revenueRows[0]?.billedMinor ?? 0,
      collectedMinor: revenueRows[0]?.collectedMinor ?? 0,
      outstandingMinor: revenueRows[0]?.outstandingMinor ?? 0,
      overdueMinor: overdueRows[0]?.overdueMinor ?? 0,
    },
    recentInvoices: recent.map((invoice) => invoice.toJSON()),
    overdueInvoices: overdueInvoices.map((invoice) => invoice.toJSON()),
  };
}

export interface SummaryResult {
  range: DateRange;
  invoiceCount: number;
  billedMinor: number;
  collectedMinor: number;
  outstandingMinor: number;
  taxableValueMinor: number;
  taxCollectedMinor: number;
  averageInvoiceMinor: number;
  paymentsReceivedMinor: number;
}

export async function getSummary(
  businessId: Types.ObjectId,
  from?: string,
  to?: string,
): Promise<SummaryResult> {
  const range = resolveRange(from, to);
  const business = new Types.ObjectId(businessId);

  const [invoiceRows, paymentRows] = await Promise.all([
    InvoiceModel.aggregate<{
      invoiceCount: number;
      billedMinor: number;
      collectedMinor: number;
      outstandingMinor: number;
      taxableValueMinor: number;
      taxCollectedMinor: number;
    }>([
      {
        $match: { businessId: business, status: 'issued', invoiceDate: dateMatch(range) },
      },
      {
        $group: {
          _id: null,
          invoiceCount: { $sum: 1 },
          billedMinor: { $sum: '$totals.totalMinor' },
          collectedMinor: { $sum: '$amountPaidMinor' },
          outstandingMinor: { $sum: '$balanceDueMinor' },
          taxableValueMinor: { $sum: '$totals.taxableTotalMinor' },
          taxCollectedMinor: { $sum: '$totals.taxTotalMinor' },
        },
      },
    ]),
    PaymentModel.aggregate<{ amountMinor: number }>([
      {
        $match: {
          businessId: business,
          status: 'active',
          paidAt: dateMatch(range),
        },
      },
      { $group: { _id: null, amountMinor: { $sum: '$amountMinor' } } },
    ]),
  ]);

  const row = invoiceRows[0];
  const invoiceCount = row?.invoiceCount ?? 0;

  return {
    range,
    invoiceCount,
    billedMinor: row?.billedMinor ?? 0,
    collectedMinor: row?.collectedMinor ?? 0,
    outstandingMinor: row?.outstandingMinor ?? 0,
    taxableValueMinor: row?.taxableValueMinor ?? 0,
    taxCollectedMinor: row?.taxCollectedMinor ?? 0,
    paymentsReceivedMinor: paymentRows[0]?.amountMinor ?? 0,
    averageInvoiceMinor:
      invoiceCount === 0 ? 0 : Math.round((row?.billedMinor ?? 0) / invoiceCount),
  };
}

export interface RevenuePoint {
  month: string;
  billedMinor: number;
  collectedMinor: number;
  invoiceCount: number;
}

export async function getRevenueByMonth(
  businessId: Types.ObjectId,
  from?: string,
  to?: string,
): Promise<{ range: DateRange; points: RevenuePoint[] }> {
  const range = resolveRange(from, to);

  const points = await InvoiceModel.aggregate<RevenuePoint>([
    {
      $match: {
        businessId: new Types.ObjectId(businessId),
        status: 'issued',
        invoiceDate: dateMatch(range),
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
        billedMinor: { $sum: '$totals.totalMinor' },
        collectedMinor: { $sum: '$amountPaidMinor' },
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, month: '$_id', billedMinor: 1, collectedMinor: 1, invoiceCount: 1 } },
  ]);

  return { range, points };
}

export interface AgingBucket {
  bucket: '0-15' | '16-30' | '31-60' | '60+';
  amountMinor: number;
  invoiceCount: number;
}

export async function getOutstandingAging(
  businessId: Types.ObjectId,
  asOf?: string,
): Promise<{ asOf: string; buckets: AgingBucket[]; totalMinor: number }> {
  const reference = asOf ?? todayIso();

  const rows = await InvoiceModel.aggregate<AgingBucket>([
    {
      $match: {
        businessId: new Types.ObjectId(businessId),
        status: 'issued',
        balanceDueMinor: { $gt: 0 },
      },
    },
    {
      $addFields: {
        daysOverdue: {
          $dateDiff: {
            startDate: '$dueDate',
            endDate: parseIsoDate(reference),
            unit: 'day',
          },
        },
      },
    },
    {
      $addFields: {
        bucket: {
          $switch: {
            branches: [
              { case: { $lte: ['$daysOverdue', 15] }, then: '0-15' },
              { case: { $lte: ['$daysOverdue', 30] }, then: '16-30' },
              { case: { $lte: ['$daysOverdue', 60] }, then: '31-60' },
            ],
            default: '60+',
          },
        },
      },
    },
    {
      $group: {
        _id: '$bucket',
        amountMinor: { $sum: '$balanceDueMinor' },
        invoiceCount: { $sum: 1 },
      },
    },
    { $project: { _id: 0, bucket: '$_id', amountMinor: 1, invoiceCount: 1 } },
  ]);

  const order: AgingBucket['bucket'][] = ['0-15', '16-30', '31-60', '60+'];
  const buckets = order.map((bucket) => {
    const found = rows.find((row) => row.bucket === bucket);

    return {
      bucket,
      amountMinor: found?.amountMinor ?? 0,
      invoiceCount: found?.invoiceCount ?? 0,
    };
  });

  return {
    asOf: reference,
    buckets,
    totalMinor: buckets.reduce((total, bucket) => total + bucket.amountMinor, 0),
  };
}

export interface GstSummaryRow {
  taxRateBp: number;
  taxableValueMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
}

export async function getGstSummary(
  businessId: Types.ObjectId,
  from?: string,
  to?: string,
): Promise<{ range: DateRange; rows: GstSummaryRow[]; totals: GstSummaryRow }> {
  const range = resolveRange(from, to);

  const rows = await InvoiceModel.aggregate<GstSummaryRow>([
    {
      $match: {
        businessId: new Types.ObjectId(businessId),
        status: 'issued',
        invoiceDate: dateMatch(range),
      },
    },
    { $unwind: '$lineItems' },
    {
      $group: {
        _id: '$lineItems.taxRateBp',
        taxableValueMinor: { $sum: '$lineItems.taxableMinor' },
        cgstMinor: { $sum: '$lineItems.cgstMinor' },
        sgstMinor: { $sum: '$lineItems.sgstMinor' },
        igstMinor: { $sum: '$lineItems.igstMinor' },
        taxMinor: { $sum: '$lineItems.taxMinor' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        taxRateBp: '$_id',
        taxableValueMinor: 1,
        cgstMinor: 1,
        sgstMinor: 1,
        igstMinor: 1,
        taxMinor: 1,
      },
    },
  ]);

  const totals = rows.reduce<GstSummaryRow>(
    (accumulator, row) => ({
      taxRateBp: 0,
      taxableValueMinor: accumulator.taxableValueMinor + row.taxableValueMinor,
      cgstMinor: accumulator.cgstMinor + row.cgstMinor,
      sgstMinor: accumulator.sgstMinor + row.sgstMinor,
      igstMinor: accumulator.igstMinor + row.igstMinor,
      taxMinor: accumulator.taxMinor + row.taxMinor,
    }),
    {
      taxRateBp: 0,
      taxableValueMinor: 0,
      cgstMinor: 0,
      sgstMinor: 0,
      igstMinor: 0,
      taxMinor: 0,
    },
  );

  return { range, rows, totals };
}

export interface TopCustomerRow {
  customerId: string;
  name: string;
  billedMinor: number;
  outstandingMinor: number;
  invoiceCount: number;
}

export async function getTopCustomers(
  businessId: Types.ObjectId,
  from?: string,
  to?: string,
  limit = 5,
): Promise<{ range: DateRange; rows: TopCustomerRow[] }> {
  const range = resolveRange(from, to);

  const rows = await InvoiceModel.aggregate<TopCustomerRow>([
    {
      $match: {
        businessId: new Types.ObjectId(businessId),
        status: 'issued',
        invoiceDate: dateMatch(range),
      },
    },
    {
      $group: {
        _id: '$customerId',
        billedMinor: { $sum: '$totals.totalMinor' },
        outstandingMinor: { $sum: '$balanceDueMinor' },
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { billedMinor: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'customers',
        localField: '_id',
        foreignField: '_id',
        as: 'customer',
      },
    },
    {
      $project: {
        _id: 0,
        customerId: { $toString: '$_id' },
        name: { $ifNull: [{ $first: '$customer.name' }, 'Unknown customer'] },
        billedMinor: 1,
        outstandingMinor: 1,
        invoiceCount: 1,
      },
    },
  ]);

  return { range, rows };
}
