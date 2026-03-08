import { Response } from 'express';
import { ProjectService } from '../../application/services/ProjectService';
import { AuthenticatedRequest } from '../middleware/auth';

const projectService = new ProjectService();

export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { clientId, projectName, description, systemType, totalValue, startDate, endDate, status } = req.body;
  const project = await projectService.create({
    clientId,
    projectName,
    description,
    systemType,
    totalValue,
    startDate,
    endDate,
    status,
  });
  res.status(201).json({ success: true, data: project });
}

export async function getProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const project = await projectService.findById(req.params.id);
  if (!project) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }
  res.json({ success: true, data: project });
}

export async function listProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientId = req.query.clientId as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const projects = await projectService.findAll({ clientId, status, search });
  res.json({ success: true, data: projects });
}

export async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const project = await projectService.update(req.params.id, req.body);
  if (!project) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }
  res.json({ success: true, data: project });
}

export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await projectService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }
  res.status(204).send();
}
