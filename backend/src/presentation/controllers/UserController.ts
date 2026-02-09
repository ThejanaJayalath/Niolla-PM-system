import { Response } from 'express';
import { UserService } from '../../application/services/UserService';
import { AuthService } from '../../application/services/AuthService';
import { AuthenticatedRequest } from '../middleware/auth';

const authService = new AuthService();
const userService = new UserService(authService);

export async function listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const role = req.user?.role;
  if (!role) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const users = await userService.listUsers(role);
    res.json({ success: true, data: users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list users';
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message } });
  }
}

export async function addUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { email, password, name, role, phone, address } = req.body;
  const requesterRole = req.user?.role;
  if (!requesterRole) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const user = await userService.addUser(email, password, name, role, requesterRole, phone, address);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add user';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function removeUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const requesterUserId = req.user?.userId;
  const requesterRole = req.user?.role;
  if (!requesterUserId || !requesterRole) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    await userService.removeUser(id, requesterUserId, requesterRole);
    res.json({ success: true, message: 'User removed' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove user';
    const status = message.includes('yourself') || message.includes('Only owner') ? 403 : 400;
    res.status(status).json({ success: false, error: { code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST', message } });
  }
}

export async function updateUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const updates = req.body;
  const requesterUserId = req.user?.userId;
  const requesterRole = req.user?.role;
  if (!requesterUserId || !requesterRole) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const updatedUser = await userService.updateUser(id, updates, requesterRole, requesterUserId);
    res.json({ success: true, data: updatedUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update user';
    const status = message.includes('Only owner') || message.includes('Cannot remove') ? 403 : 400;
    res.status(status).json({ success: false, error: { code: status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST', message } });
  }
}

export async function getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const user = await userService.getUserById(id);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get user';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function setUserPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { newPassword } = req.body;
  const requesterUserId = req.user?.userId;
  const requesterRole = req.user?.role;
  if (!requesterUserId || !requesterRole) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    await userService.setUserPassword(id, newPassword, requesterUserId, requesterRole);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update password';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}
