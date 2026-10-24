import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';

import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../lib/errors.js';

export { AppError } from '../lib/errors.js';
export type { ErrorCode } from '../lib/errors.js';

function requestIdOf(res: Parameters<RequestHandler>[1]): string {
  const value: unknown = res.locals.requestId;

  return typeof value === 'string' ? value : '';
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
      requestId: requestIdOf(res),
    },
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const requestId = requestIdOf(res);

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The request did not pass validation',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        requestId,
      },
    });

    return;
  }

  // Mongoose validation runs again on updates, so it needs the same shape as a
  // Zod failure rather than a 500.
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The request did not pass validation',
        details: Object.entries(error.errors).map(([path, issue]) => ({
          path,
          message: issue.message,
        })),
        requestId,
      },
    });

    return;
  }

  // A duplicate key means a unique index caught what the service layer missed.
  if (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 11_000
  ) {
    const keyValue = (error as { keyValue?: unknown }).keyValue;

    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'That value is already in use',
        ...(keyValue === undefined ? {} : { details: keyValue }),
        requestId,
      },
    });

    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId,
      },
    });

    return;
  }

  // body-parser failures arrive as plain errors with a type tag. A malformed
  // body is the client's fault and must not look like a server fault.
  const bodyParserType = (error as { type?: unknown }).type;

  if (bodyParserType === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The request body is not valid JSON',
        requestId,
      },
    });

    return;
  }

  if (bodyParserType === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The request body is larger than 1 MB',
        requestId,
      },
    });

    return;
  }

  logger.error({ err: error, requestId }, 'Unhandled request error');

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Something went wrong' : String((error as Error).message),
      requestId,
    },
  });
};
