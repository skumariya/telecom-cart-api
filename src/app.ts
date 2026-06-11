import express, { Application } from 'express';
import { Container } from 'inversify';
import { buildContainer } from './config/inversify.config';
import { buildRouter } from './config/routes.config';
import { errorHandlerMiddleware } from './middlewares/error-handler.middleware';


export function createApp(container?: Container): Application {
  const app = express();

  app.use(express.json());
  app.disable('x-powered-by');
  app.disable('etag');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // resolve container
  const resolvedContainer = container ?? buildContainer();
  // build routing for API/V1
  app.use('/api/v1', buildRouter(resolvedContainer));

  // Error handler must be the last middleware registered
  app.use(errorHandlerMiddleware);

  return app;
}
