/**
 * Cron: scan first project anniversaries today and notify owners (daily ~8 AM).
 *   0 8 * * * cd /path/to/backend && npx ts-node scripts/scanAnniversaries.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/infrastructure/database/mongo';
import { EngagementService } from '../src/application/services/EngagementService';

dotenv.config();

async function run() {
  await connectDatabase();
  const service = new EngagementService();
  const result = await service.scanAndNotifyOwnersAnniversaries();
  console.log(
    `Anniversary scan completed. ${result.anniversaryCount} anniversary(ies) today; ${result.notificationsCreated} owner notification(s) created.`
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Anniversary scan job failed:', err);
  process.exit(1);
});
