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
  /** Monthly base pay for employees (before wallet bonuses). */
  baseSalary?: number;
  /** YYYY-MM-DD — used for birthday card automation */
  dateOfBirth?: string;
}

export type UserRole = 'owner' | 'pm' | 'employee';
