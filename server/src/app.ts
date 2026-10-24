import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { allowedOrigins, isTest } from './config/env.js';
import { logger } from './config/logger.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { requestId } from './middleware/request-id.js';
import { healthRouter } from './routes/health.js';
import { v1Router } from './routes/v1.js';

export function buildApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      autoLogging: !isTest,
      // The request id is already on the response, no need for a second one.
      genReqId: (_req, res) => res.getHeader('X-Request-Id')?.toString() ?? '',
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/health', healthRouter);

  if (!isTest) {
    app.use('/api/v1', apiLimiter);
  }
  app.use('/api/v1', v1Router);

  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  // Swagger UI ships inline scripts, so its CSP is dropped. helmet cannot unset a
  // header it already wrote, so the removal has to be explicit, and only here.
  app.use('/api/docs', (_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
