import type { Types } from 'mongoose';
import type { z } from 'zod';

import {
  BusinessModel,
  BusinessSettingsModel,
  type BusinessDocument,
  type BusinessSettingsDocument,
} from '../models/index.js';
import { notFound } from '../lib/errors.js';
import type { updateBusinessSchema, updateSettingsSchema } from '../schemas/business.schemas.js';

export interface BusinessContext {
  business: BusinessDocument;
  settings: BusinessSettingsDocument;
}

export async function getBusinessContext(businessId: Types.ObjectId): Promise<BusinessContext> {
  const [business, settings] = await Promise.all([
    BusinessModel.findById(businessId).exec(),
    BusinessSettingsModel.findOne({ businessId }).exec(),
  ]);

  if (business === null) {
    throw notFound('Business');
  }

  const settingsDocument = settings ?? (await BusinessSettingsModel.create({ businessId }));

  return { business, settings: settingsDocument };
}

export async function updateBusiness(
  businessId: Types.ObjectId,
  input: z.infer<typeof updateBusinessSchema>,
): Promise<object> {
  const business = await BusinessModel.findOneAndUpdate(
    { _id: businessId },
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  ).exec();

  if (business === null) {
    throw notFound('Business');
  }

  return business.toJSON();
}

export async function updateSettings(
  businessId: Types.ObjectId,
  input: z.infer<typeof updateSettingsSchema>,
): Promise<object> {
  const settings = await BusinessSettingsModel.findOneAndUpdate(
    { businessId },
    { $set: input, $setOnInsert: { businessId } },
    { returnDocument: 'after', upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).exec();

  if (settings === null) {
    throw notFound('Settings');
  }

  return settings.toJSON();
}
