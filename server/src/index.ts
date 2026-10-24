import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = buildApp();

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(
    { port: env.PORT, host: env.HOST, environment: env.NODE_ENV },
    'Nexora InvoicePro API is listening',
  );
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info({ signal }, 'Shutting down');

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out, exiting');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((error) => {
    clearTimeout(forceExit);

    if (error) {
      logger.error({ err: error }, 'Failed to close the HTTP server');
      process.exit(1);
    }

    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
