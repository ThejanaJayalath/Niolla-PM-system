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
}

export type UserRole = 'owner' | 'pm' | 'employee';
