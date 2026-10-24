import type { Types } from 'mongoose';

import { InvoiceCounterModel } from '../models/index.js';
import { AppError } from '../lib/errors.js';
import { fiscalYearFor } from '../lib/dates.js';

const MAX_ATTEMPTS = 3;

/**
 * Numbers are assigned at issue time from a per-business, per-fiscal-year
 * counter. The $inc is atomic, and the unique index on the counter makes two
 * simultaneous first-use upserts collide, which the retry absorbs.
 */
export async function nextInvoiceNumber(
  businessId: Types.ObjectId,
  prefix: string,
  series: string,
  issuedOn: Date,
): Promise<string> {
  const fiscalYear = fiscalYearFor(issuedOn);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const counter = await InvoiceCounterModel.findOneAndUpdate(
        { businessId, series, fiscalYear },
        { $inc: { seq: 1 } },
        {
          upsert: true,
          returnDocument: 'after',
          setDefaultsOnInsert: false,
        },
      ).exec();

      if (counter === null) {
        throw new AppError(500, 'INTERNAL_ERROR', 'Could not allocate an invoice number');
      }

      return `${prefix}/${fiscalYear}/${String(counter.seq).padStart(4, '0')}`;
    } catch (error) {
      const isDuplicateKey =
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: unknown }).code === 11_000;

      if (!isDuplicateKey || attempt === MAX_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Could not allocate an invoice number');
}
