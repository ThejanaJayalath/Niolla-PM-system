import './loadEnv';
import http from 'http';
import mongoose from 'mongoose';
import { connectDatabase } from './infrastructure/database/mongo';
import { app } from './presentation/app';

const PORT = Number(process.env.PORT) || 5000;

let server: http.Server | null = null;

function closeServer(): Promise<void> {
  if (!server) return Promise.resolve();
  const current = server;
  server = null;
  return new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      console.warn('HTTP close timed out — forcing exit');
      resolve();
    }, 3000);
    current.close(() => {
      clearTimeout(forceTimer);
      resolve();
    });
    if (typeof (current as http.Server & { closeAllConnections?: () => void }).closeAllConnections === 'function') {
      (current as http.Server & { closeAllConnections: () => void }).closeAllConnections();
    }
  });
}

async function bootstrap(): Promise<void> {
  await connectDatabase();

  server = app.listen(PORT, () => {
    console.log(`Niolla PM API running on http://localhost:${PORT}`);
    console.log(`API base: http://localhost:${PORT}/api/v1`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use. Stop other backend instances:\n` +
          `  netstat -ano | findstr :${PORT}\n` +
          `  taskkill /PID <pid> /F`
      );
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received — closing HTTP server`);
    void closeServer()
      .then(() => mongoose.connection.close(false))
      .finally(() => process.exit(0));
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
