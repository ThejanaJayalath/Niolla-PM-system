/**
 * Cron: scan today's birthdays and notify owners (run daily at 8:00 AM).
 * Example (Windows Task Scheduler / cron):
 *   0 8 * * * cd /path/to/backend && npx ts-node scripts/scanBirthdays.ts
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase } from '../src/infrastructure/database/mongo';
import { BirthdayService } from '../src/application/services/BirthdayService';

dotenv.config();

async function run() {
  await connectDatabase();
  const service = new BirthdayService();
  const result = await service.scanAndNotifyOwners();
  console.log(
    `Birthday scan completed. ${result.birthdayCount} birthday(s) today; ${result.notificationsCreated} owner notification(s) created.`
  );
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Birthday scan job failed:', err);
  process.exit(1);
});
