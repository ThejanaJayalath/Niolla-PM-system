import './loadEnv';
import mongoose from 'mongoose';
import { connectDatabase } from './infrastructure/database/mongo';
import { app } from './presentation/app';

const PORT = Number(process.env.PORT) || 5000;

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    console.log(`Niolla PM API running on http://localhost:${PORT}`);
    console.log(`API base: http://localhost:${PORT}/api/v1`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received — closing HTTP server`);
    server.close(() => {
      void mongoose.connection.close(false).finally(() => process.exit(0));
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
