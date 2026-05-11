export interface User {
  _id?: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  status: 'active' | 'suspended';
  phone?: string;
  address?: string;
  profilePhoto?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  /** Approved developer payouts (available to withdraw / internal ledger). */
  walletBalance?: number;
}

export type UserRole = 'owner' | 'pm' | 'employee';
