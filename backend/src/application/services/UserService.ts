import bcrypt from 'bcryptjs';
import { User, UserRole } from '../../domain/entities/User';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { AuthService } from './AuthService';

export type PublicUser = Omit<User, 'passwordHash'>;

export class UserService {
  constructor(private authService: AuthService) {}

  async listUsers(requesterRole: string): Promise<PublicUser[]> {
    if (requesterRole !== 'owner') {
      throw new Error('Only owner can list all users');
    }
    const docs = await UserModel.find().sort({ createdAt: -1 });
    return docs.map((d) => {
      const obj = d.toObject();
      const { passwordHash, ...rest } = obj;
      return rest as unknown as PublicUser;
    });
  }

  async addUser(
    email: string,
    password: string,
    name: string,
    role: 'pm' | 'employee',
    requesterRole: string
  ): Promise<PublicUser> {
    if (requesterRole !== 'owner') {
      throw new Error('Only owner can add users');
    }
    const user = await this.authService.register(email, password, name, role);
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async removeUser(targetUserId: string, requesterUserId: string, requesterRole: string): Promise<void> {
    if (requesterRole !== 'owner') {
      throw new Error('Only owner can remove users');
    }
    if (targetUserId === requesterUserId) {
      throw new Error('Cannot remove yourself');
    }
    const doc = await UserModel.findByIdAndDelete(targetUserId);
    if (!doc) throw new Error('User not found');
  }

  async setUserPassword(
    targetUserId: string,
    newPassword: string,
    requesterUserId: string,
    requesterRole: string
  ): Promise<void> {
    if (requesterRole !== 'owner' && targetUserId !== requesterUserId) {
      throw new Error('You can only change your own password');
    }
    const doc = await UserModel.findById(targetUserId);
    if (!doc) throw new Error('User not found');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    doc.passwordHash = passwordHash;
    await doc.save();
  }
}
