export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'REFRESH_REUSED'
  | 'EMAIL_TAKEN'
  | 'FORBIDDEN_ROLE'
  | 'FORBIDDEN_ORIGIN'
  | 'CONFLICT'
  | 'INVOICE_NOT_DRAFT'
  | 'INVOICE_ALREADY_ISSUED'
  | 'INVOICE_HAS_PAYMENTS'
  | 'INSUFFICIENT_BALANCE'
  | 'CUSTOMER_HAS_INVOICES'
  | 'PRODUCT_IN_USE'
  | 'PRODUCT_INACTIVE'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'RATE_LIMITED'
  | 'MAIL_NOT_CONFIGURED'
  | 'DATABASE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

/**
 * An error the client is allowed to see. Anything else becomes a generic 500 so
 * a stack trace or a driver message never reaches the browser.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFound(what = 'Resource'): AppError {
  return new AppError(404, 'NOT_FOUND', `${what} not found`);
}

export function unauthenticated(message = 'Sign in to continue'): AppError {
  return new AppError(401, 'UNAUTHENTICATED', message);
}

export function forbiddenRole(message = 'Your role does not allow this action'): AppError {
  return new AppError(403, 'FORBIDDEN_ROLE', message);
}

export function conflict(code: ErrorCode, message: string, details?: unknown): AppError {
  return new AppError(409, code, message, details);
}
