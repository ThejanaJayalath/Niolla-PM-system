import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { ProjectTaskService } from '../../application/services/ProjectTaskService';

const projectTaskService = new ProjectTaskService();

function isAdmin(role: string | undefined): boolean {
  return role === 'owner' || role === 'pm';
}

export async function listProjectTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  const projectId = (req.query.projectId as string | undefined)?.trim();

  try {
    if (isAdmin(req.user?.role)) {
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'projectId query is required for admin list' },
        });
        return;
      }
      const data = await projectTaskService.listForProject(projectId);
      res.json({ success: true, data });
      return;
    }
    if (req.user?.role === 'employee') {
      let data = await projectTaskService.listForAssignee(userId);
      if (projectId) {
        data = data.filter((t) => t.projectId === projectId);
      }
      res.json({ success: true, data });
      return;
    }
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'List failed';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function createProjectTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!isAdmin(req.user?.role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can create tasks' } });
    return;
  }
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  const { projectId, requirementId, title, description, assigneeIds } = req.body as {
    projectId?: string;
    requirementId?: string;
    title?: string;
    description?: string;
    assigneeIds?: string[];
  };
  if (!projectId?.trim() || !title?.trim()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'projectId and title are required' },
    });
    return;
  }
  try {
    const data = await projectTaskService.create({
      projectId: projectId.trim(),
      requirementId: requirementId?.trim(),
      title: title.trim(),
      description: description?.trim(),
      assigneeIds: Array.isArray(assigneeIds) ? assigneeIds : [],
      createdBy: userId,
    });
    res.status(201).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Create failed';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function updateProjectTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  const id = req.params.id;
  const body = req.body as {
    title?: string;
    description?: string;
    assigneeIds?: string[];
    completed?: boolean;
  };
  const asAdmin = isAdmin(req.user?.role);
  try {
    const result = await projectTaskService.update(
      id,
      {
        title: body.title,
        description: body.description,
        assigneeIds: body.assigneeIds,
        completed: body.completed,
      },
      { asAdmin, userId }
    );
    if (!result) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
      return;
    }
    res.json({
      success: true,
      data: {
        ...result.task,
        payoutSubmitted: result.payoutSubmitted,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function deleteProjectTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!isAdmin(req.user?.role)) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can delete tasks' } });
    return;
  }
  const ok = await projectTaskService.delete(req.params.id);
  if (!ok) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return;
  }
  res.json({ success: true, data: { deleted: true } });
}
