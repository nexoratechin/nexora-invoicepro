import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

import { isTest } from '../config/env.js';

interface LimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
}

function jsonLimiter({ windowMs, limit, message }: LimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => isTest,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message,
          requestId: typeof res.locals.requestId === 'string' ? res.locals.requestId : '',
        },
      });
    },
  });
}

export const apiLimiter = jsonLimiter({
  windowMs: 60_000,
  limit: 300,
  message: 'Too many requests. Try again in a minute.',
});

export const loginLimiter = jsonLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many sign in attempts from this address. Try again in 15 minutes.',
});

export const registerLimiter = jsonLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many accounts created from this address. Try again later.',
});

export const sensitiveLimiter = jsonLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many attempts. Try again in an hour.',
});
