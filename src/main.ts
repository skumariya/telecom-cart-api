import 'reflect-metadata';
import { createApp } from './app';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

const app = createApp();

app.listen(PORT, () => {
  console.log(`Telecom Cart API  →  http://localhost:${PORT}/api/v1`);
  console.log(`Health check      →  http://localhost:${PORT}/api/v1/health`);
});
