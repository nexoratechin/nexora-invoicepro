import type { Schema } from 'mongoose';

/**
 * Every document leaves the API with `_id` renamed to `id`, no `__v`, and no
 * password hash, even if a query forgot to exclude it.
 */
export function jsonPlugin(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform: (_document, returned: Record<string, unknown>) => {
      const id = returned._id;

      delete returned._id;
      delete returned.__v;
      delete returned.passwordHash;
      delete returned.tokenHash;

      if (id !== undefined) {
        returned.id = String(id);
      }

      return returned;
    },
  });

  schema.set('toObject', { virtuals: false });
}
