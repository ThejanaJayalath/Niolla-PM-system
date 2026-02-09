import bcrypt from 'bcryptjs';
import { User, UserRole } from '../../domain/entities/User';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { AuthService } from './AuthService';

export type PublicUser = Omit<User, 'passwordHash'>;

export class UserService {
  constructor(private authService: AuthService) {}

  async listUsers(requesterRole: string): Promise<PublicUser[]> {
    // Allow PMs to list users too, but with limited permissions
    if (requesterRole !== 'owner' && requesterRole !== 'pm') {
      throw new Error('Only owner or PM can list all users');
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
    address?: string
  ): Promise<PublicUser> {
    // Allow PMs to add users too
    if (requesterRole !== 'owner' && requesterRole !== 'pm') {
      throw new Error('Only owner or PM can add users');
    }
    const user = await this.authService.register(email, password, name, role);
    
    // Update with additional fields
    const userDoc = await UserModel.findById(user._id);
    if (userDoc) {
      if (phone) userDoc.phone = phone;
      if (address) userDoc.address = address;
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
    
    if (!isOwnProfile && requesterRole !== 'owner' && requesterRole !== 'pm') {
      throw new Error('Only owner or PM can update other users');
    }
    
    // Check if updating role to owner
    if (updates.role === 'owner' && requesterRole !== 'owner') {
      throw new Error('Only owner can set owner role');
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
    
    // Only owners and PMs can update role and status
    if (requesterRole === 'owner' || requesterRole === 'pm') {
      if (updates.role && (requesterRole === 'owner' || (requesterRole === 'pm' && updates.role !== 'owner'))) {
        doc.role = updates.role;
      }
      if (updates.status) doc.status = updates.status;
    }

    await doc.save();

    const { passwordHash, ...rest } = doc.toObject();
    return {
      ...rest,
      _id: (rest._id as any).toString(),
    } as unknown as PublicUser;
  }

  async removeUser(targetUserId: string, requesterUserId: string, requesterRole: string): Promise<void> {
    if (requesterRole !== 'owner') {
      throw new Error('Only owner can remove users');
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
