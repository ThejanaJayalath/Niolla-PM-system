/**
 * Cron script: update overdue_days and status=overdue for installments past due date.
 * Run daily via system cron or scheduler, e.g.:
 *   0 0 * * * cd /path/to/backend && npx ts-node scripts/updateOverdue.ts
 * Or after build: node dist/scripts/updateOverdue.js (if you copy scripts to dist).
 */
import dotenv from 'dotenv';
import { connectDatabase } from '../src/infrastructure/database/mongo';
import { InstallmentService } from '../src/application/services/InstallmentService';
import mongoose from 'mongoose';

dotenv.config();

async function run() {
  await connectDatabase();
  const service = new InstallmentService();
  const updated = await service.updateOverdueInstallments();
  console.log(`Update overdue job completed. Updated ${updated} installment(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('Update overdue job failed:', err);
  process.exit(1);
});
