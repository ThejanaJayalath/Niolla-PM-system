import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../../domain/entities/User';
import { UserModel } from '../../infrastructure/database/models/UserModel';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN_SEC = 7 * 24 * 60 * 60; // 7 days

export interface LoginResult {
  user: Omit<User, 'passwordHash'>;
  token: string;
}

export class AuthService {
  async login(email: string, password: string): Promise<LoginResult | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    if (!doc) return null;
    const match = await bcrypt.compare(password, doc.passwordHash);
    if (!match) return null;

    const user = doc.toObject();
    const { passwordHash, ...userWithoutPassword } = user;
    const token = jwt.sign(
      { userId: String(user._id), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN_SEC }
    );

    return {
      user: userWithoutPassword as unknown as Omit<User, 'passwordHash'>,
      token,
    };
  }

  async register(email: string, password: string, name: string, role: UserRole = 'employee'): Promise<User> {
    const existing = await UserModel.findOne({ email: email.toLowerCase() });
    if (existing) throw new Error('User with this email already exists');

    const passwordHash = await bcrypt.hash(password, 10);
    const doc = await UserModel.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
    });
    return doc.toObject() as unknown as User;
  }

  async getCurrentUser(userId: string): Promise<User | null> {
    const doc = await UserModel.findById(userId);
    if (!doc) return null;
    return doc.toObject() as unknown as User;
  }

  async changeOwnPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const doc = await UserModel.findById(userId);
    if (!doc) throw new Error('User not found');
    const match = await bcrypt.compare(currentPassword, doc.passwordHash);
    if (!match) throw new Error('Current password is incorrect');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    doc.passwordHash = passwordHash;
    await doc.save();
  }

  private static readonly MAX_PHOTO_BASE64_LENGTH = 3 * 1024 * 1024; // ~2MB image as base64

  async updateProfilePhoto(userId: string, photoBase64: string | null): Promise<User | null> {
    const doc = await UserModel.findById(userId);
    if (!doc) return null;
    if (photoBase64 !== null) {
      if (typeof photoBase64 !== 'string' || !photoBase64.startsWith('data:image/')) {
        throw new Error('Invalid image: must be a data URL (data:image/...)');
      }
      if (photoBase64.length > AuthService.MAX_PHOTO_BASE64_LENGTH) {
        throw new Error('Image too large. Please use an image under 2MB.');
      }
      doc.profilePhoto = photoBase64;
    } else {
      doc.profilePhoto = undefined;
    }
    await doc.save();
    return doc.toObject() as unknown as User;
  }

  verifyToken(token: string): { userId: string; email: string; role: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
      return decoded;
    } catch {
      return null;
    }
  }
}
