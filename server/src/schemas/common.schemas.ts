import { z } from 'zod';

import { GSTIN_PATTERN } from '@nexora/shared';

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Must be a 24 character hex id');

export const addressInputSchema = z
  .object({
    line1: z.string().trim().max(200).default(''),
    line2: z.string().trim().max(200).default(''),
    city: z.string().trim().max(80).default(''),
    state: z.string().trim().max(80).default(''),
    pincode: z.string().trim().max(12).default(''),
    country: z.string().trim().max(80).default('India'),
  })
  .strict();

export const optionalGstinSchema = z
  .union([z.literal(''), z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Invalid GSTIN')])
  .default('');

export const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().max(40).optional(),
});

export interface Page {
  page: number;
  pageSize: number;
  skip: number;
  limit: number;
}

export function toPage(input: { page: number; pageSize: number }): Page {
  return {
    page: input.page,
    pageSize: input.pageSize,
    skip: (input.page - 1) * input.pageSize,
    limit: input.pageSize,
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(
  items: T[],
  total: number,
  page: { page: number; pageSize: number },
): Paginated<T> {
  return {
    items,
    page: page.page,
    pageSize: page.pageSize,
    total,
    totalPages: Math.ceil(total / page.pageSize),
  };
}

/**
 * Sort keys come from the client, so they are matched against an allowlist. An
 * unknown key falls back to the default instead of reaching the query.
 */
export function parseSort(
  sort: string | undefined,
  allowed: readonly string[],
  fallback: string,
): Record<string, 1 | -1> {
  const candidate = sort ?? fallback;
  const descending = candidate.startsWith('-');
  const field = descending ? candidate.slice(1) : candidate;

  if (!allowed.includes(field)) {
    const fallbackField = fallback.startsWith('-') ? fallback.slice(1) : fallback;

    return { [fallbackField]: fallback.startsWith('-') ? -1 : 1 };
  }

  return { [field]: descending ? -1 : 1 };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
