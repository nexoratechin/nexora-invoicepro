import { randomUUID } from 'node:crypto';

import mongoose from 'mongoose';
import { inject } from 'vitest';

let dbName: string | null = null;

export async function connectTestDb(): Promise<void> {
  const uri = inject('mongoUri');
  dbName = `test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function disconnectTestDb(): Promise<void> {
  if (dbName !== null) {
    await mongoose.connection.dropDatabase();
  }

  await mongoose.disconnect();
  dbName = null;
}

/** Clears collections between tests without dropping the indexes. */
export async function clearDatabase(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();

  if (collections === undefined) {
    return;
  }

  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}
