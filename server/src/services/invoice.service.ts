import { Types } from 'mongoose';

import {
  computeInvoice,
  derivePaymentState,
  isOverdue,
  resolveTaxTreatment,
  type InvoiceTotals,
  type TaxTreatment,
} from '@nexora/shared';

import {
  BusinessModel,
  BusinessSettingsModel,
  CustomerModel,
  InvoiceModel,
  PaymentModel,
  ProductModel,
  type InvoiceDocument,
  type InvoiceLineItem,
  type InvoiceEvent,
} from '../models/index.js';
import { addDaysIso, parseIsoDate, toIsoDate, todayIso } from '../lib/dates.js';
import { AppError, conflict, notFound } from '../lib/errors.js';
import { escapeRegex, paginated, parseSort, toPage } from '../schemas/common.schemas.js';
import type { Paginated } from '../schemas/common.schemas.js';
import type {
  CreateInvoiceInput,
  ListInvoicesQuery,
  UpdateInvoiceInput,
} from '../schemas/invoice.schemas.js';
import { getBusinessContext } from './business.service.js';
import { nextInvoiceNumber } from './numbering.service.js';

const SORTABLE = ['invoiceDate', 'dueDate', 'createdAt', 'invoiceNumber'] as const;

function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'VALIDATION_FAILED', message, details);
}

async function buildLines(
  businessId: Types.ObjectId,
  lineItems: CreateInvoiceInput['lineItems'],
  taxTreatment: TaxTreatment,
): Promise<{ storedLines: InvoiceLineItem[]; totals: InvoiceTotals }> {
  const productIds = lineItems
    .map((line) => line.productId)
    .filter((value): value is string => typeof value === 'string');

  if (productIds.length > 0) {
    const products = await ProductModel.find({
      businessId,
      _id: { $in: productIds.map((id) => new Types.ObjectId(id)) },
    }).exec();

    const found = new Map(products.map((product) => [product._id.toString(), product]));

    for (const id of productIds) {
      if (!found.has(id)) {
        throw notFound('Product');
      }
    }

    for (const product of products) {
      if (!product.isActive) {
        throw new AppError(
          400,
          'PRODUCT_INACTIVE',
          `"${product.name}" is inactive and cannot be added to a new invoice`,
        );
      }
    }
  }

  const { lines, totals } = computeInvoice(lineItems, taxTreatment);

  const storedLines: InvoiceLineItem[] = lines.map((line) => ({
    ...line,
    productId: line.productId === null ? null : new Types.ObjectId(line.productId),
  }));

  return { storedLines, totals };
}

function assertDueDate(invoiceDate: string, dueDate: string): void {
  if (parseIsoDate(dueDate) < parseIsoDate(invoiceDate)) {
    throw badRequest('The due date cannot be before the invoice date');
  }
}

function withOverdue(invoice: InvoiceDocument): Record<string, unknown> {
  return {
    ...invoice.toJSON(),
    overdue: isOverdue(
      toIsoDate(invoice.dueDate),
      invoice.balanceDueMinor,
      invoice.status,
      todayIso(),
    ),
  };
}

async function findScopedInvoice(
  businessId: Types.ObjectId,
  invoiceId: string,
): Promise<InvoiceDocument> {
  const invoice = await InvoiceModel.findOne({ _id: invoiceId, businessId }).exec();

  if (invoice === null) {
    throw notFound('Invoice');
  }

  return invoice;
}

/**
 * Issue time reads plain objects, because a snapshot should be a frozen copy and
 * not a live subdocument.
 */
async function loadIssueContext(businessId: Types.ObjectId, invoice: InvoiceDocument) {
  const [business, settings, customer] = await Promise.all([
    BusinessModel.findById(businessId).lean().exec(),
    BusinessSettingsModel.findOne({ businessId }).lean().exec(),
    CustomerModel.findOne({ _id: invoice.customerId, businessId }).lean().exec(),
  ]);

  if (business === null) {
    throw notFound('Business');
  }

  if (settings === null) {
    throw notFound('Settings');
  }

  if (customer === null) {
    throw notFound('Customer');
  }

  return { business, settings, customer };
}

export async function createDraft(
  businessId: Types.ObjectId,
  actorUserId: Types.ObjectId,
  input: CreateInvoiceInput,
): Promise<object> {
  const { business, settings } = await getBusinessContext(businessId);

  const customer = await CustomerModel.findOne({ _id: input.customerId, businessId }).exec();

  if (customer === null) {
    throw notFound('Customer');
  }

  if (customer.status === 'archived') {
    throw conflict('CONFLICT', 'This customer is archived. Restore them before invoicing.');
  }

  assertDueDate(input.invoiceDate, input.dueDate);

  const placeOfSupply = input.placeOfSupplyStateCode ?? customer.stateCode ?? business.stateCode;
  const taxTreatment = resolveTaxTreatment(business.stateCode, placeOfSupply);
  const { storedLines, totals } = await buildLines(businessId, input.lineItems, taxTreatment);

  const invoice = await InvoiceModel.create({
    businessId,
    customerId: customer._id,
    invoiceNumber: null,
    status: 'draft',
    paymentState: derivePaymentState(totals.totalMinor, 0),
    invoiceDate: parseIsoDate(input.invoiceDate),
    dueDate: parseIsoDate(input.dueDate),
    placeOfSupplyStateCode: placeOfSupply,
    taxTreatment,
    lineItems: storedLines,
    totals,
    amountPaidMinor: 0,
    balanceDueMinor: totals.totalMinor,
    notes: input.notes.length > 0 ? input.notes : (settings.defaultNotes ?? ''),
    terms: input.terms,
    events: [
      {
        type: 'created',
        message: 'Draft created',
        actorUserId,
        createdAt: new Date(),
      },
    ],
  });

  return withOverdue(invoice);
}

export async function updateDraft(
  businessId: Types.ObjectId,
  actorUserId: Types.ObjectId,
  invoiceId: string,
  input: UpdateInvoiceInput,
): Promise<object> {
  const invoice = await findScopedInvoice(businessId, invoiceId);

  if (invoice.status !== 'draft') {
    throw conflict('INVOICE_NOT_DRAFT', 'Only a draft can be edited');
  }

  const { business } = await getBusinessContext(businessId);
  const customerId = input.customerId ?? invoice.customerId.toString();
  const customer = await CustomerModel.findOne({ _id: customerId, businessId }).exec();

  if (customer === null) {
    throw notFound('Customer');
  }

  const invoiceDate = input.invoiceDate ?? toIsoDate(invoice.invoiceDate);
  const dueDate = input.dueDate ?? toIsoDate(invoice.dueDate);

  assertDueDate(invoiceDate, dueDate);

  const placeOfSupply = input.placeOfSupplyStateCode ?? invoice.placeOfSupplyStateCode;
  const taxTreatment = resolveTaxTreatment(business.stateCode, placeOfSupply);

  const lines =
    input.lineItems ??
    invoice.lineItems.map((line) => ({
      productId: line.productId === null ? undefined : line.productId.toString(),
      description: line.description,
      hsnSac: line.hsnSac,
      unitLabel: line.unitLabel,
      quantityMilli: line.quantityMilli,
      unitPriceMinor: line.unitPriceMinor,
      discountBp: line.discountBp,
      taxRateBp: line.taxRateBp,
    }));

  const { storedLines, totals } = await buildLines(businessId, lines, taxTreatment);

  const event: InvoiceEvent = {
    type: 'updated',
    message: 'Draft updated',
    actorUserId,
    createdAt: new Date(),
  };

  const updated = await InvoiceModel.findOneAndUpdate(
    { _id: invoice._id, businessId, status: 'draft' },
    {
      $set: {
        customerId: customer._id,
        invoiceDate: parseIsoDate(invoiceDate),
        dueDate: parseIsoDate(dueDate),
        placeOfSupplyStateCode: placeOfSupply,
        taxTreatment,
        lineItems: storedLines,
        totals,
        balanceDueMinor: totals.totalMinor,
        paymentState: derivePaymentState(totals.totalMinor, 0),
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.terms === undefined ? {} : { terms: input.terms }),
      },
      $push: { events: event },
    },
    { returnDocument: 'after', runValidators: true },
  ).exec();

  if (updated === null) {
    throw conflict('INVOICE_NOT_DRAFT', 'The invoice changed while it was being saved');
  }

  return withOverdue(updated);
}

export async function issueInvoice(
  businessId: Types.ObjectId,
  actorUserId: Types.ObjectId,
  invoiceId: string,
): Promise<object> {
  const invoice = await findScopedInvoice(businessId, invoiceId);

  if (invoice.status === 'issued') {
    throw conflict('INVOICE_ALREADY_ISSUED', 'This invoice has already been issued');
  }

  if (invoice.status === 'void') {
    throw conflict('CONFLICT', 'A void invoice cannot be issued again. Duplicate it instead.');
  }

  const { business, settings, customer } = await loadIssueContext(businessId, invoice);

  const now = new Date();
  const invoiceNumber = await nextInvoiceNumber(
    businessId,
    settings.invoicePrefix,
    settings.numberSeries ?? 'INV',
    now,
  );

  const updated = await InvoiceModel.findOneAndUpdate(
    { _id: invoice._id, businessId, status: 'draft' },
    {
      $set: {
        status: 'issued',
        invoiceNumber,
        issuedAt: now,
        invoiceDate: invoice.invoiceDate,
        customerSnapshot: {
          name: customer.name,
          gstin: customer.gstin,
          email: customer.email,
          phone: customer.phone,
          billingAddress: customer.billingAddress,
          stateCode: customer.stateCode,
        },
        businessSnapshot: {
          name: business.name,
          gstin: business.gstin,
          address: business.address,
          stateCode: business.stateCode,
          phone: business.phone,
          email: business.email,
          logoPath: business.logoPath,
          bankDetails: settings.bankDetails,
        },
        balanceDueMinor: invoice.totals.totalMinor - invoice.amountPaidMinor,
        paymentState: derivePaymentState(invoice.totals.totalMinor, invoice.amountPaidMinor),
      },
      $push: {
        events: {
          type: 'issued',
          message: `Issued as ${invoiceNumber}`,
          actorUserId,
          createdAt: now,
        } satisfies InvoiceEvent,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).exec();

  if (updated === null) {
    throw conflict('INVOICE_ALREADY_ISSUED', 'The invoice was issued by another request');
  }

  return withOverdue(updated);
}

export async function voidInvoice(
  businessId: Types.ObjectId,
  actorUserId: Types.ObjectId,
  invoiceId: string,
  reason: string,
): Promise<object> {
  const invoice = await findScopedInvoice(businessId, invoiceId);

  if (invoice.status === 'draft') {
    throw conflict('CONFLICT', 'A draft can be deleted. Only an issued invoice can be voided.');
  }

  if (invoice.status === 'void') {
    throw conflict('CONFLICT', 'This invoice is already void');
  }

  const activePayments = await PaymentModel.countDocuments({
    businessId,
    invoiceId: invoice._id,
    status: 'active',
  }).exec();

  if (activePayments > 0) {
    throw conflict('INVOICE_HAS_PAYMENTS', 'Void the payments on this invoice before voiding it', {
      paymentCount: activePayments,
    });
  }

  const now = new Date();

  const updated = await InvoiceModel.findOneAndUpdate(
    { _id: invoice._id, businessId, status: 'issued' },
    {
      $set: { status: 'void', voidReason: reason, voidedAt: now },
      $push: {
        events: {
          type: 'void',
          message: `Voided: ${reason}`,
          actorUserId,
          createdAt: now,
        } satisfies InvoiceEvent,
      },
    },
    { returnDocument: 'after' },
  ).exec();

  if (updated === null) {
    throw conflict('CONFLICT', 'The invoice changed while it was being voided');
  }

  return withOverdue(updated);
}

export async function duplicateInvoice(
  businessId: Types.ObjectId,
  actorUserId: Types.ObjectId,
  invoiceId: string,
): Promise<object> {
  const invoice = await findScopedInvoice(businessId, invoiceId);
  const { settings } = await getBusinessContext(businessId);
  const today = todayIso();
  const source = invoice.toObject();

  const copy = await InvoiceModel.create({
    businessId,
    customerId: invoice.customerId,
    invoiceNumber: null,
    status: 'draft',
    paymentState: 'unpaid',
    invoiceDate: parseIsoDate(today),
    dueDate: parseIsoDate(addDaysIso(today, settings.defaultPaymentTermsDays)),
    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
    taxTreatment: invoice.taxTreatment,
    lineItems: source.lineItems,
    totals: source.totals,
    amountPaidMinor: 0,
    balanceDueMinor: invoice.totals.totalMinor,
    notes: invoice.notes,
    terms: invoice.terms,
    events: [
      {
        type: 'created',
        message: `Duplicated from ${invoice.invoiceNumber ?? 'a draft'}`,
        actorUserId,
        createdAt: new Date(),
      },
    ],
  });

  return withOverdue(copy);
}

export async function deleteDraft(businessId: Types.ObjectId, invoiceId: string): Promise<void> {
  const invoice = await findScopedInvoice(businessId, invoiceId);

  if (invoice.status !== 'draft') {
    throw conflict('CONFLICT', 'Only a draft can be deleted. Void an issued invoice instead.');
  }

  await InvoiceModel.deleteOne({ _id: invoice._id, businessId, status: 'draft' }).exec();
}

export interface InvoiceDetail {
  invoice: object;
  customer: object | null;
  payments: object[];
}

export async function getInvoiceDocument(
  businessId: Types.ObjectId,
  invoiceId: string,
): Promise<InvoiceDocument> {
  return findScopedInvoice(businessId, invoiceId);
}

export async function getInvoice(
  businessId: Types.ObjectId,
  invoiceId: string,
): Promise<InvoiceDetail> {
  const invoice = await findScopedInvoice(businessId, invoiceId);
  const customer = await CustomerModel.findOne({
    _id: invoice.customerId,
    businessId,
  }).exec();

  return {
    invoice: withOverdue(invoice),
    customer:
      customer === null
        ? null
        : {
            id: customer._id.toString(),
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            gstin: customer.gstin,
            stateCode: customer.stateCode,
            status: customer.status,
          },
    payments: await PaymentModel.find({ businessId, invoiceId: invoice._id })
      .sort({ paidAt: -1 })
      .exec()
      .then((payments) => payments.map((payment) => payment.toJSON())),
  };
}

export async function listInvoices(
  businessId: Types.ObjectId,
  query: ListInvoicesQuery,
): Promise<Paginated<object>> {
  const page = toPage(query);
  const filter: Record<string, unknown> = { businessId };
  const today = todayIso();

  if (query.status !== undefined) {
    filter.status = query.status;
  }

  if (query.paymentState !== undefined) {
    filter.paymentState = query.paymentState;
  }

  if (query.customerId !== undefined) {
    filter.customerId = new Types.ObjectId(query.customerId);
  }

  if (query.overdue === 'true') {
    filter.status = 'issued';
    filter.balanceDueMinor = { $gt: 0 };
    filter.dueDate = { $lt: parseIsoDate(today) };
  }

  if (query.from !== undefined || query.to !== undefined) {
    filter.invoiceDate = {
      ...(query.from === undefined ? {} : { $gte: parseIsoDate(query.from) }),
      ...(query.to === undefined ? {} : { $lte: parseIsoDate(query.to) }),
    };
  }

  if (query.q !== undefined && query.q.length > 0) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    const matchingCustomers = await CustomerModel.find({ businessId, name: pattern })
      .select('_id')
      .exec();

    filter.$or = [
      { invoiceNumber: pattern },
      { 'customerSnapshot.name': pattern },
      { customerId: { $in: matchingCustomers.map((customer) => customer._id) } },
    ];
  }

  const [items, total] = await Promise.all([
    InvoiceModel.find(filter)
      .sort(parseSort(query.sort, SORTABLE, '-invoiceDate'))
      .skip(page.skip)
      .limit(page.limit)
      .populate('customerId', 'name email')
      .exec(),
    InvoiceModel.countDocuments(filter).exec(),
  ]);

  return paginated(
    items.map((item) => withOverdue(item)),
    total,
    page,
  );
}
