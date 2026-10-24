import pino from 'pino';

import { env, isProduction } from './env.js';

/**
 * Structured logging with the sensitive fields removed. Tokens, cookies and
 * request bodies never reach the log stream.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'nexora-invoicepro-api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      'refreshToken',
      'accessToken',
      'token',
    ],
    censor: '[redacted]',
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
});
