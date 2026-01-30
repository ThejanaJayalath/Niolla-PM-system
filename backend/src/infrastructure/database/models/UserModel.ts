import mongoose, { Schema, Document } from 'mongoose';
import { User, UserRole } from '../../../domain/entities/User';

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'] as UserRole[], default: 'admin' },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
