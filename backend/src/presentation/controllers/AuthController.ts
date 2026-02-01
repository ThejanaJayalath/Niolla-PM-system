import { Response } from 'express';
import { AuthService } from '../../application/services/AuthService';
import { Request } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';

const authService = new AuthService();

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  if (!result) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } });
    return;
  }
  res.json({ success: true, data: result });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, name, role } = req.body;
  try {
    const user = await authService.register(email, password, name, role || 'employee');
    const { passwordHash, ...userWithoutPassword } = user;
    res.status(201).json({ success: true, data: userWithoutPassword });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function changeOwnPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    await authService.changeOwnPassword(userId, currentPassword, newPassword);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update password';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}
