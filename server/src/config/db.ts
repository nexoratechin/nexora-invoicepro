import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

/**
 * No global `sanitizeFilter`. It rewrites every `{ $gte: ... }` style operator
 * into `{ $eq: { $gte: ... } }`, which breaks the conditional balance update
 * that payments depend on. Filters in this codebase are built server side from
 * Zod validated primitives and never from a client supplied object, so there is
 * nothing for the sanitizer to defend against here.
 */

export async function connectDatabase(uri: string | undefined = env.MONGODB_URI): Promise<void> {
  if (uri === undefined || uri.length === 0) {
    throw new Error('MONGODB_URI is not set. Copy server/.env.example to server/.env.');
  }

  mongoose.connection.on('error', (error) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
  });

  // Build the indexes declared on the schemas before serving traffic. A unique
  // index that is still being built would let a duplicate slip through.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  logger.info(
    { database: mongoose.connection.name, host: mongoose.connection.host },
    'MongoDB connected',
  );
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
