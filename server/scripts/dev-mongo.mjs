import { writeFileSync } from 'node:fs';

import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * A throwaway MongoDB for development on a machine without one installed.
 *
 *   npm run dev:db -w @nexora/server
 *
 * It prints a connection string and writes it to server/.dev-mongo-uri. Data
 * lasts only as long as this process. For real work, point MONGODB_URI at Atlas
 * or a local mongod instead.
 */
const mongo = await MongoMemoryServer.create({
  instance: { dbName: 'nexora_invoicepro', launchTimeout: 60_000 },
});

const uri = mongo.getUri();

writeFileSync(new URL('../.dev-mongo-uri', import.meta.url), uri);

process.stdout.write(
  [
    'In-memory MongoDB is running.',
    `URI: ${uri}`,
    'Put that value in server/.env as MONGODB_URI, then run: npm run seed',
    'Data is lost when this process stops.',
    '',
  ].join('\n'),
);

setInterval(() => undefined, 1 << 30);

async function stop() {
  await mongo.stop();
  process.exit(0);
}

process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
