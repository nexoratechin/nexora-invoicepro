import { type QueryFilter, Types } from 'mongoose';

import type { CustomerStatus } from '@nexora/shared';

import { InvoiceModel, CustomerModel, type Customer } from '../models/index.js';
import { AppError, conflict, notFound } from '../lib/errors.js';
import { escapeRegex, paginated, parseSort, toPage } from '../schemas/common.schemas.js';
import type { Paginated } from '../schemas/common.schemas.js';
import type { CreateCustomerInput, UpdateCustomerInput } from '../schemas/customer.schemas.js';

const SORTABLE = ['name', 'createdAt', 'updatedAt', 'status'] as const;

export interface CustomerStats {
  totalBilledMinor: number;
  totalPaidMinor: number;
  outstandingMinor: number;
  invoiceCount: number;
  lastInvoiceAt: Date | null;
}

export async function listCustomers(
  businessId: Types.ObjectId,
  query: { q?: string; status?: CustomerStatus; page: number; pageSize: number; sort?: string },
): Promise<Paginated<unknown>> {
  const page = toPage(query);
  const filter: QueryFilter<Customer> = { businessId };

  if (query.status !== undefined) {
    filter.status = query.status;
  }

  if (query.q !== undefined && query.q.length > 0) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { gstin: pattern }];
  }

  const [items, total] = await Promise.all([
    CustomerModel.find(filter)
      .sort(parseSort(query.sort, SORTABLE, 'name'))
      .skip(page.skip)
      .limit(page.limit)
      .exec(),
    CustomerModel.countDocuments(filter).exec(),
  ]);

  return paginated(
    items.map((item) => item.toJSON()),
    total,
    page,
  );
}

export async function createCustomer(
  businessId: Types.ObjectId,
  input: CreateCustomerInput,
): Promise<object> {
  const customer = await CustomerModel.create({
    ...input,
    businessId,
    email: input.email.toLowerCase(),
  });

  return customer.toJSON();
}

export async function getCustomer(
  businessId: Types.ObjectId,
  customerId: string,
): Promise<{ customer: Record<string, unknown>; stats: CustomerStats }> {
  const customer = await CustomerModel.findOne({ _id: customerId, businessId }).exec();

  if (customer === null) {
    throw notFound('Customer');
  }

  const aggregate = await InvoiceModel.aggregate<{
    totalBilledMinor: number;
    totalPaidMinor: number;
    outstandingMinor: number;
    invoiceCount: number;
    lastInvoiceAt: Date | null;
  }>([
    {
      $match: {
        businessId: new Types.ObjectId(businessId),
        customerId: new Types.ObjectId(customer._id),
        status: 'issued',
      },
    },
    {
      $group: {
        _id: null,
        totalBilledMinor: { $sum: '$totals.totalMinor' },
        totalPaidMinor: { $sum: '$amountPaidMinor' },
        outstandingMinor: { $sum: '$balanceDueMinor' },
        invoiceCount: { $sum: 1 },
        lastInvoiceAt: { $max: '$invoiceDate' },
      },
    },
  ]);

  const stats = aggregate[0] ?? {
    totalBilledMinor: 0,
    totalPaidMinor: 0,
    outstandingMinor: 0,
    invoiceCount: 0,
    lastInvoiceAt: null,
  };

  return { customer: customer.toJSON(), stats };
}

export async function updateCustomer(
  businessId: Types.ObjectId,
  customerId: string,
  input: UpdateCustomerInput,
): Promise<object> {
  const customer = await CustomerModel.findOneAndUpdate(
    { _id: customerId, businessId },
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  ).exec();

  if (customer === null) {
    throw notFound('Customer');
  }

  return customer.toJSON();
}

export async function setCustomerStatus(
  businessId: Types.ObjectId,
  customerId: string,
  status: CustomerStatus,
): Promise<object> {
  const customer = await CustomerModel.findOneAndUpdate(
    { _id: customerId, businessId },
    { $set: { status } },
    { returnDocument: 'after' },
  ).exec();

  if (customer === null) {
    throw notFound('Customer');
  }

  return customer.toJSON();
}

export async function deleteCustomer(
  businessId: Types.ObjectId,
  customerId: string,
): Promise<void> {
  const customer = await CustomerModel.findOne({ _id: customerId, businessId }).exec();

  if (customer === null) {
    throw notFound('Customer');
  }

  const blockingInvoices = await InvoiceModel.countDocuments({
    businessId,
    customerId: customer._id,
    status: { $ne: 'void' },
  }).exec();

  if (blockingInvoices > 0) {
    throw conflict(
      'CUSTOMER_HAS_INVOICES',
      `This customer has ${String(blockingInvoices)} invoice(s). Archive them instead of deleting.`,
      { invoiceCount: blockingInvoices },
    );
  }

  const deleted = await CustomerModel.deleteOne({ _id: customer._id, businessId }).exec();

  if (deleted.deletedCount === 0) {
    throw new AppError(409, 'CONFLICT', 'The customer could not be deleted');
  }
}
