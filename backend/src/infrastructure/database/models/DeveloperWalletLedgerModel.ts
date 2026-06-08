import mongoose, { Schema, Document } from 'mongoose';

/** Wallet ledger row: Pending until admin approves, then Available (credited to balance). */
export type WalletStatus = 'Pending' | 'Available';

export interface DeveloperWalletLedgerDocument extends Document {
  developerId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  /** Update task payout credited on admin approval (separate from main project payout row). */
  updateTicketId?: mongoose.Types.ObjectId;
  projectName: string;
  amount: number;
  walletStatus: WalletStatus;
  /** @deprecated Legacy field — use walletStatus. Kept for migration only. */
  status?: string;
  submittedAt: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const developerWalletLedgerSchema = new Schema<DeveloperWalletLedgerDocument>(
  {
    developerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    updateTicketId: { type: Schema.Types.ObjectId, ref: 'UpdateTicket', index: true },
    projectName: { type: String, required: true },
    amount: { type: Number, required: true },
    walletStatus: {
      type: String,
      enum: ['Pending', 'Available'],
      required: true,
      index: true,
    },
    status: { type: String, enum: ['pending_review', 'approved'], required: false },
    submittedAt: { type: Date, required: true, index: true },
    approvedAt: { type: Date },
  },
  { timestamps: true, collection: 'developerwalletledgers' }
);

developerWalletLedgerSchema.index(
  { developerId: 1, projectId: 1 },
  { unique: true, partialFilterExpression: { updateTicketId: { $exists: false } } }
);
developerWalletLedgerSchema.index(
  { developerId: 1, updateTicketId: 1 },
  { unique: true, partialFilterExpression: { updateTicketId: { $exists: true } } }
);

/** MongoDB model name `Wallet`; physical collection stays `developerwalletledgers` for existing data. */
export const WalletModel = mongoose.model<DeveloperWalletLedgerDocument>(
  'Wallet',
  developerWalletLedgerSchema,
  'developerwalletledgers'
);

export const DeveloperWalletLedgerModel = WalletModel;

let walletLedgerMigrated = false;

/** Maps legacy `status` to `walletStatus` once per process. */
export async function ensureWalletLedgerWalletStatusMigrated(): Promise<void> {
  if (walletLedgerMigrated) return;
  const col = WalletModel.collection;
  await col.updateMany(
    { walletStatus: { $exists: false }, status: 'pending_review' },
    { $set: { walletStatus: 'Pending' } }
  );
  await col.updateMany(
    { walletStatus: { $exists: false }, status: 'approved' },
    { $set: { walletStatus: 'Available' } }
  );
  await col.updateMany({ walletStatus: { $exists: false } }, { $set: { walletStatus: 'Pending' } });
  try {
    await col.dropIndex('developerId_1_projectId_1');
  } catch {
    /* index may already be partial or absent */
  }
  try {
    await col.createIndex(
      { developerId: 1, projectId: 1 },
      { unique: true, partialFilterExpression: { updateTicketId: { $exists: false } } }
    );
  } catch {
    /* already exists */
  }
  try {
    await col.createIndex(
      { developerId: 1, updateTicketId: 1 },
      { unique: true, partialFilterExpression: { updateTicketId: { $exists: true } } }
    );
  } catch {
    /* already exists */
  }
  walletLedgerMigrated = true;
}
