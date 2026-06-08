import bcrypt from 'bcryptjs';
import { DeveloperTrack, User, UserRole } from '../../domain/entities/User';
import {
  canCreateRole,
  canDeleteAccounts,
  canManageAccounts,
} from '../../domain/roles';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { AuthService } from './AuthService';

export type PublicUser = Omit<User, 'passwordHash'>;

export class UserService {
  constructor(private authService: AuthService) {}

  async listUsers(requesterRole: string): Promise<PublicUser[]> {
    if (!canManageAccounts(requesterRole)) {
      throw new Error('Only Super Admin or Management can list staff accounts');
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
    requesterRole: string,
    phone?: string,
    address?: string,
    dateOfBirth?: string,
    developerTrack?: DeveloperTrack
  ): Promise<PublicUser> {
    if (!canManageAccounts(requesterRole)) {
      throw new Error('Only Super Admin or Management can create accounts');
    }
    if (!canCreateRole(requesterRole, role)) {
      throw new Error('Management can only create Developer accounts. Super Admin creates Management and Developers.');
    }
    const user = await this.authService.register(email, password, name, role);

    const userDoc = await UserModel.findById(user._id);
    if (userDoc) {
      if (phone) userDoc.phone = phone;
      if (address) userDoc.address = address;
      if (dateOfBirth?.trim()) userDoc.dateOfBirth = dateOfBirth.trim();
      if (role === 'employee' && developerTrack) {
        userDoc.developerTrack = developerTrack;
      }
      await userDoc.save();
    }
    
    const { passwordHash, ...rest } = (userDoc?.toObject() || user);
    return {
      ...rest,
      _id: (rest._id as any).toString(),
    } as unknown as PublicUser;
  }

  async updateUser(
    targetUserId: string,
    updates: Partial<Omit<User, 'passwordHash' | '_id'>>,
    requesterRole: string,
    requesterUserId: string
  ): Promise<PublicUser> {
    // Check permissions
    const isOwnProfile = requesterUserId === targetUserId;
    
    if (!isOwnProfile && !canManageAccounts(requesterRole)) {
      throw new Error('Only Super Admin or Management can update other accounts');
    }

    if (updates.role === 'owner' && requesterRole !== 'owner') {
      throw new Error('Only Super Admin can assign Super Admin role');
    }

    if (updates.role === 'pm' && requesterRole === 'pm') {
      throw new Error('Management cannot change roles to Management');
    }

    if (updates.role && requesterRole === 'pm' && updates.role !== 'employee') {
      throw new Error('Management can only manage Developer accounts');
    }
    
    // Cannot update own role to non-owner if you're the only owner
    if (updates.role && updates.role !== 'owner' && requesterRole === 'owner' && requesterUserId === targetUserId) {
      const ownerCount = await UserModel.countDocuments({ role: 'owner' });
      if (ownerCount === 1) {
        throw new Error('Cannot remove the last owner');
      }
    }

    const doc = await UserModel.findById(targetUserId);
    if (!doc) throw new Error('User not found');

    // Apply updates
    // Users can only update certain fields on their own profile
    if (updates.name) doc.name = updates.name;
    if (updates.phone) doc.phone = updates.phone;
    if (updates.address) doc.address = updates.address;
    if (updates.dateOfBirth !== undefined) {
      const dob = updates.dateOfBirth as string | null;
      doc.dateOfBirth = dob && String(dob).trim() ? String(dob).trim() : undefined;
    }

    if (updates.developerTrack !== undefined) {
      const track = updates.developerTrack as DeveloperTrack | null | undefined;
      doc.developerTrack =
        doc.role === 'employee' && track && ['frontend', 'backend', 'fullstack'].includes(track)
          ? track
          : undefined;
    }

    if (requesterRole === 'owner' || requesterRole === 'pm') {
      if (
        updates.role &&
        (requesterRole === 'owner' || (requesterRole === 'pm' && updates.role === 'employee'))
      ) {
        doc.role = updates.role;
        if (doc.role !== 'employee') doc.developerTrack = undefined;
      }
      if (updates.status) doc.status = updates.status;
      if (updates.baseSalary !== undefined && doc.role === 'employee') {
        const base = Number(updates.baseSalary);
        if (!Number.isFinite(base) || base < 0) throw new Error('baseSalary must be a non-negative number');
        doc.baseSalary = base;
      }
    }

    await doc.save();

    const { passwordHash, ...rest } = doc.toObject();
    return {
      ...rest,
      _id: (rest._id as any).toString(),
    } as unknown as PublicUser;
  }

  async removeUser(targetUserId: string, requesterUserId: string, requesterRole: string): Promise<void> {
    if (!canDeleteAccounts(requesterRole)) {
      throw new Error('Only Super Admin can delete accounts');
    }
    if (targetUserId === requesterUserId) {
      throw new Error('Cannot remove yourself');
    }
    
    // Check if removing the last owner
    const userDoc = await UserModel.findById(targetUserId);
    if (userDoc?.role === 'owner') {
      const ownerCount = await UserModel.countDocuments({ role: 'owner' });
      if (ownerCount === 1) {
        throw new Error('Cannot remove the last owner');
      }
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

  async getUserById(userId: string): Promise<PublicUser | null> {
    const doc = await UserModel.findById(userId);
    if (!doc) return null;
    const { passwordHash, ...rest } = doc.toObject();
    return {
      ...rest,
      _id: (rest._id as any).toString(),
    } as unknown as PublicUser;
  }
}
