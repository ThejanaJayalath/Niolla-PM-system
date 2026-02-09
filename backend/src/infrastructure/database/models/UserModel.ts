import mongoose, { Schema, Document } from 'mongoose';
import { User, UserRole } from '../../../domain/entities/User';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  status: 'active' | 'suspended';
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['owner', 'pm', 'employee'] as UserRole[], default: 'employee' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    phone: { type: String },
    address: { type: String },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
