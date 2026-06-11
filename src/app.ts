import express from 'express';


export function createApp() {
  const app = express();

  app.use(express.json());
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });


  return app;
}
