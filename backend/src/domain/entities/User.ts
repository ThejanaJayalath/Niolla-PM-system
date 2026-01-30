export interface User {
  _id?: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user';
