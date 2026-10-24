import { type HydratedDocument, type InferSchemaType, model, Schema, type Types } from 'mongoose';

import { jsonPlugin } from './plugins.js';

const productSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, default: '', maxlength: 500 },
    sku: { type: String, trim: true, uppercase: true, default: null, maxlength: 40 },
    unitLabel: { type: String, trim: true, default: 'unit', maxlength: 20 },
    unitPriceMinor: { type: Number, required: true, min: 0, max: 1_000_000_000 },
    taxRateBp: { type: Number, required: true, min: 0, max: 10_000, default: 1800 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ businessId: 1, isActive: 1, name: 1 });
productSchema.index({ businessId: 1, name: 1 });
productSchema.index(
  { businessId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: 'string' } } },
);

productSchema.plugin(jsonPlugin);

export type Product = InferSchemaType<typeof productSchema> & { businessId: Types.ObjectId };
export type ProductDocument = HydratedDocument<Product>;

export const ProductModel = model('Product', productSchema);
