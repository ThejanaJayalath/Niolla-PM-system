import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../../domain/entities/User';
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

  async register(email: string, password: string, name: string, role: 'admin' | 'user' = 'admin'): Promise<User> {
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

  verifyToken(token: string): { userId: string; email: string; role: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
      return decoded;
    } catch {
      return null;
    }
  }
}
