import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

/**
 * One MongoDB process for the whole test run. Each test file connects to its own
 * database name so files cannot see each other's data.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const mongo = await MongoMemoryServer.create();

  project.provide('mongoUri', mongo.getUri());

  return async () => {
    await mongo.stop();
  };
}

declare module 'vitest' {
  interface ProvidedContext {
    mongoUri: string;
  }
}
