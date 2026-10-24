import { type QueryFilter, type Types } from 'mongoose';

import { InvoiceModel, ProductModel, type Product } from '../models/index.js';
import { conflict, notFound } from '../lib/errors.js';
import { escapeRegex, paginated, parseSort, toPage } from '../schemas/common.schemas.js';
import type { Paginated } from '../schemas/common.schemas.js';
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from '../schemas/product.schemas.js';

const SORTABLE = ['name', 'unitPriceMinor', 'createdAt', 'updatedAt'] as const;

export async function listProducts(
  businessId: Types.ObjectId,
  query: ListProductsQuery,
): Promise<Paginated<object>> {
  const page = toPage(query);
  const filter: QueryFilter<Product> = { businessId };

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  if (query.q !== undefined && query.q.length > 0) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { sku: pattern }, { description: pattern }];
  }

  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(parseSort(query.sort, SORTABLE, 'name'))
      .skip(page.skip)
      .limit(page.limit)
      .exec(),
    ProductModel.countDocuments(filter).exec(),
  ]);

  return paginated(
    items.map((item) => item.toJSON()),
    total,
    page,
  );
}

export async function createProduct(
  businessId: Types.ObjectId,
  input: CreateProductInput,
): Promise<object> {
  const product = await ProductModel.create({
    ...input,
    businessId,
    sku: input.sku.length > 0 ? input.sku : null,
  });

  return product.toJSON();
}

export async function getProduct(businessId: Types.ObjectId, productId: string): Promise<object> {
  const product = await ProductModel.findOne({ _id: productId, businessId }).exec();

  if (product === null) {
    throw notFound('Product');
  }

  return product.toJSON();
}

export async function updateProduct(
  businessId: Types.ObjectId,
  productId: string,
  input: UpdateProductInput,
): Promise<object> {
  const update: Record<string, unknown> = { ...input };

  if (input.sku !== undefined) {
    update.sku = input.sku.length > 0 ? input.sku : null;
  }

  const product = await ProductModel.findOneAndUpdate(
    { _id: productId, businessId },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  ).exec();

  if (product === null) {
    throw notFound('Product');
  }

  return product.toJSON();
}

export async function setProductStatus(
  businessId: Types.ObjectId,
  productId: string,
  isActive: boolean,
): Promise<object> {
  const product = await ProductModel.findOneAndUpdate(
    { _id: productId, businessId },
    { $set: { isActive } },
    { returnDocument: 'after' },
  ).exec();

  if (product === null) {
    throw notFound('Product');
  }

  return product.toJSON();
}

export async function deleteProduct(businessId: Types.ObjectId, productId: string): Promise<void> {
  const product = await ProductModel.findOne({ _id: productId, businessId }).exec();

  if (product === null) {
    throw notFound('Product');
  }

  // A line item copied the product details at invoice time, but the reference is
  // still used for reporting, so a used product is deactivated instead.
  const usedOnInvoice = await InvoiceModel.exists({
    businessId,
    'lineItems.productId': product._id,
  });

  if (usedOnInvoice !== null) {
    throw conflict(
      'PRODUCT_IN_USE',
      'This product appears on an invoice. Deactivate it instead of deleting.',
    );
  }

  await ProductModel.deleteOne({ _id: product._id, businessId }).exec();
}
