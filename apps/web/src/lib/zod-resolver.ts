import type { FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

type Errors = Record<string, unknown>;

function setAtPath(target: Errors, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: Errors = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index] ?? '';

    if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
      cursor[segment] = /^\d+$/.test(segments[index + 1] ?? '') ? [] : {};
    }

    cursor = cursor[segment] as Errors;
  }

  const last = segments[segments.length - 1] ?? '';

  // The first issue per field wins, which is what the form should show.
  if (cursor[last] === undefined) {
    cursor[last] = value;
  }
}

/**
 * A small Zod resolver for React Hook Form. Written here instead of pulling in
 * @hookform/resolvers, whose optional peer graph fought npm's resolver.
 */
export function zodResolver<T extends FieldValues>(schema: ZodType<T>): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Errors = {};

    for (const issue of result.error.issues) {
      setAtPath(errors, issue.path.join('.'), {
        type: issue.code,
        message: issue.message,
      });
    }

    return { values: {}, errors: errors as never };
  };
}
