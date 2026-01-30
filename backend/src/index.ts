import dotenv from 'dotenv';
import { connectDatabase } from './infrastructure/database/mongo';
import { app } from './presentation/app';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`Niolla PM API running on http://localhost:${PORT}`);
    console.log(`API base: http://localhost:${PORT}/api/v1`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
