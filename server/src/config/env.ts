import 'dotenv/config';

import { z } from 'zod';

const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(logLevels).default('info'),
  APP_VERSION: z.string().default('0.1.0'),
  MONGODB_URI: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  process.stderr.write(`Invalid environment configuration:\n${problems}\n`);
  process.exit(1);
}

export const env = parsed.data;

const TEST_FALLBACK_SECRET = 'nexora-test-only-secret-do-not-deploy-0123456789';

function resolveSecret(
  name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET',
  value: string | undefined,
): string {
  if (value !== undefined) {
    return value;
  }

  if (env.NODE_ENV === 'test') {
    return `${TEST_FALLBACK_SECRET}-${name}`;
  }

  process.stderr.write(
    `${name} is missing. Generate one with:\n` +
      "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"\n",
  );
  process.exit(1);
}

export const secrets = {
  access: resolveSecret('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET),
  refresh: resolveSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET),
};

/** Origins allowed to call the API from a browser. */
export const allowedOrigins = env.WEB_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
