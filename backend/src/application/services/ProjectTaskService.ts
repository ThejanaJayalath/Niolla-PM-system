import mongoose from 'mongoose';
import { ProjectTask } from '../../domain/entities/ProjectTask';
import { ProjectTaskModel } from '../../infrastructure/database/models/ProjectTaskModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { CustomerRequirementModel } from '../../infrastructure/database/models/CustomerRequirementModel';
import { ProjectService } from './ProjectService';
import { UpdateTicketService } from './UpdateTicketService';

export interface ProjectTaskUpdateResult {
  task: ProjectTask;
  payoutSubmitted?: boolean;
}

export interface CreateProjectTaskInput {
  projectId: string;
  requirementId?: string;
  title: string;
  description?: string;
  assigneeIds?: string[];
  createdBy: string;
}

export interface UpdateProjectTaskInput {
  title?: string;
  description?: string;
  assigneeIds?: string[];
  completed?: boolean;
}

export class ProjectTaskService {
  private toTask(
    o: Record<string, unknown>,
    extras?: { projectName?: string; requirementTitle?: string }
  ): ProjectTask {
    const projectIdRaw = o.projectId as { toString?: () => string } | string | undefined;
    const requirementIdRaw = o.requirementId as { toString?: () => string } | string | undefined;
    const updateTicketIdRaw = o.updateTicketId as
      | { toString?: () => string; ticketId?: string }
      | string
      | undefined;
    const createdByRaw = o.createdBy as { toString?: () => string } | string | undefined;
    const completedByRaw = o.completedBy as { toString?: () => string } | string | undefined;
    const assignees = (o.assigneeIds as unknown[] | undefined) || [];
    return {
      _id: (o._id as { toString: () => string }).toString(),
      projectId:
        typeof projectIdRaw === 'string'
          ? projectIdRaw
          : projectIdRaw && typeof projectIdRaw.toString === 'function'
            ? projectIdRaw.toString()
            : '',
      requirementId:
        requirementIdRaw === undefined || requirementIdRaw === null
          ? undefined
          : typeof requirementIdRaw === 'string'
            ? requirementIdRaw
            : typeof requirementIdRaw === 'object' && requirementIdRaw.toString
              ? requirementIdRaw.toString()
              : undefined,
      updateTicketId:
        updateTicketIdRaw === undefined || updateTicketIdRaw === null
          ? undefined
          : typeof updateTicketIdRaw === 'string'
            ? updateTicketIdRaw
            : typeof updateTicketIdRaw === 'object' && updateTicketIdRaw.toString
              ? updateTicketIdRaw.toString()
              : undefined,
      title: String(o.title || ''),
      description: (o.description as string) || undefined,
      assigneeIds: assignees.map((id) =>
        typeof id === 'string' ? id : (id as { toString: () => string }).toString()
      ),
      completed: Boolean(o.completed),
      completedAt: o.completedAt ? new Date(o.completedAt as string | Date) : undefined,
      completedBy:
        completedByRaw === undefined || completedByRaw === null
          ? undefined
          : typeof completedByRaw === 'string'
            ? completedByRaw
            : typeof completedByRaw === 'object' && (completedByRaw as { toString?: () => string }).toString
              ? (completedByRaw as { toString: () => string }).toString()
              : undefined,
      createdBy:
        typeof createdByRaw === 'string'
          ? createdByRaw
          : createdByRaw && typeof createdByRaw.toString === 'function'
            ? createdByRaw.toString()
            : '',
      createdAt: o.createdAt ? new Date(o.createdAt as string | Date) : undefined,
      updatedAt: o.updatedAt ? new Date(o.updatedAt as string | Date) : undefined,
      ...extras,
    };
  }

  async create(data: CreateProjectTaskInput): Promise<ProjectTask> {
    if (!mongoose.Types.ObjectId.isValid(data.projectId)) throw new Error('Invalid project');
    const project = await ProjectModel.findById(data.projectId).select('_id').lean();
    if (!project) throw new Error('Project not found');

    let requirementOid: mongoose.Types.ObjectId | undefined;
    if (data.requirementId?.trim()) {
      if (!mongoose.Types.ObjectId.isValid(data.requirementId)) throw new Error('Invalid requirement');
      const reqDoc = await CustomerRequirementModel.findOne({
        _id: new mongoose.Types.ObjectId(data.requirementId),
        projectRef: new mongoose.Types.ObjectId(data.projectId),
      })
        .select('title')
        .lean();
      if (!reqDoc) throw new Error('Requirement not found on this project');
      requirementOid = new mongoose.Types.ObjectId(data.requirementId);
    }

    const assigneeOids = (data.assigneeIds || [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const doc = await ProjectTaskModel.create({
      projectId: new mongoose.Types.ObjectId(data.projectId),
      requirementId: requirementOid,
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      assigneeIds: assigneeOids,
      completed: false,
      createdBy: new mongoose.Types.ObjectId(data.createdBy),
    });

    const populated = await ProjectTaskModel.findById(doc._id)
      .populate('projectId', 'projectName')
      .populate('requirementId', 'title')
      .populate('updateTicketId', 'ticketId')
      .lean();

    return this.mapPopulated(populated as Record<string, unknown>);
  }

  private mapPopulated(o: Record<string, unknown>): ProjectTask {
    const proj = o.projectId as { projectName?: string } | null;
    const req = o.requirementId as { title?: string } | null;
    const ticket = o.updateTicketId as { ticketId?: string } | null;
    const base = this.toTask(o, {
      projectName: proj && typeof proj === 'object' ? proj.projectName : undefined,
      requirementTitle: req && typeof req === 'object' ? req.title : undefined,
    });
    if (ticket && typeof ticket === 'object' && ticket.ticketId) {
      base.ticketId = ticket.ticketId;
    }
    if (proj && typeof proj === 'object' && '_id' in proj) {
      base.projectId = (proj as { _id: { toString: () => string } })._id.toString();
    }
    if (req && typeof req === 'object' && '_id' in req && o.requirementId) {
      base.requirementId = (req as { _id: { toString: () => string } })._id.toString();
    }
    return base;
  }

  async findById(id: string): Promise<ProjectTask | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await ProjectTaskModel.findById(id)
      .populate('projectId', 'projectName')
      .populate('requirementId', 'title')
      .populate('updateTicketId', 'ticketId')
      .lean();
    return doc ? this.mapPopulated(doc as unknown as Record<string, unknown>) : null;
  }

  async listForProject(projectId: string): Promise<ProjectTask[]> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) return [];
    const docs = await ProjectTaskModel.find({ projectId: new mongoose.Types.ObjectId(projectId) })
      .populate('projectId', 'projectName')
      .populate('requirementId', 'title')
      .populate('updateTicketId', 'ticketId')
      .sort({ completed: 1, createdAt: -1 })
      .lean();
    return docs.map((d) => this.mapPopulated(d as unknown as Record<string, unknown>));
  }

  async listForAssignee(employeeId: string): Promise<ProjectTask[]> {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) return [];
    const eid = new mongoose.Types.ObjectId(employeeId);
    const docs = await ProjectTaskModel.find({ assigneeIds: eid })
      .populate('projectId', 'projectName')
      .populate('requirementId', 'title')
      .populate('updateTicketId', 'ticketId')
      .sort({ completed: 1, createdAt: -1 })
      .lean();
    return docs.map((d) => this.mapPopulated(d as unknown as Record<string, unknown>));
  }

  async update(
    id: string,
    data: UpdateProjectTaskInput,
    opts: { asAdmin: boolean; userId: string }
  ): Promise<ProjectTaskUpdateResult | null> {
    const existing = await ProjectTaskModel.findById(id).lean();
    if (!existing) return null;

    const update: Record<string, unknown> = {};

    if (opts.asAdmin) {
      if (data.title !== undefined) update.title = String(data.title).trim();
      if (data.description !== undefined) update.description = data.description?.trim() || undefined;
      if (data.assigneeIds !== undefined) {
        update.assigneeIds = data.assigneeIds
          .filter((x) => mongoose.Types.ObjectId.isValid(x))
          .map((x) => new mongoose.Types.ObjectId(x));
      }
    }

    if (data.completed !== undefined) {
      const assignees = ((existing.assigneeIds as { toString: () => string }[]) || []).map((x) => x.toString());
      const canToggle =
        opts.asAdmin || assignees.includes(opts.userId);
      if (!canToggle) throw new Error('Not assigned to this task');

      const linkedUpdateTicketId = existing.updateTicketId
        ? (existing.updateTicketId as { toString: () => string }).toString()
        : undefined;
      if (linkedUpdateTicketId && data.completed === true && !opts.asAdmin) {
        const updateTicketService = new UpdateTicketService();
        await updateTicketService.workerComplete(linkedUpdateTicketId, opts.userId);
        const task = await this.findById(id);
        return task ? { task } : null;
      }
      if (linkedUpdateTicketId && data.completed === false) {
        throw new Error('Update ticket tasks cannot be reopened from Tasks');
      }

      update.completed = Boolean(data.completed);
      if (data.completed) {
        update.completedAt = new Date();
        update.completedBy = new mongoose.Types.ObjectId(opts.userId);
      } else {
        update.completedAt = undefined;
        update.completedBy = undefined;
      }
    }

    if (Object.keys(update).length === 0) {
      const task = await this.findById(id);
      return task ? { task } : null;
    }

    const doc = await ProjectTaskModel.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('projectId', 'projectName')
      .populate('requirementId', 'title')
      .populate('updateTicketId', 'ticketId')
      .lean();
    if (!doc) return null;

    const task = this.mapPopulated(doc as unknown as Record<string, unknown>);
    let payoutSubmitted = false;

    if (data.completed === true && !opts.asAdmin) {
      const projectIdRaw = (existing.projectId as { toString: () => string }).toString();
      payoutSubmitted = await this.maybeSubmitPayoutWhenAllTasksDone(projectIdRaw, opts.userId);
    }

    return { task, payoutSubmitted: payoutSubmitted || undefined };
  }

  /** When every task assigned to this developer on the project is complete, submit for admin approval. */
  private async maybeSubmitPayoutWhenAllTasksDone(projectId: string, developerUserId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(developerUserId)) return false;
    const pid = new mongoose.Types.ObjectId(projectId);
    const eid = new mongoose.Types.ObjectId(developerUserId);
    const tasks = await ProjectTaskModel.find({
      projectId: pid,
      assigneeIds: eid,
      updateTicketId: { $exists: false },
    })
      .select('completed')
      .lean();
    if (tasks.length === 0) return false;
    if (!tasks.every((t) => t.completed)) return false;

    const projectService = new ProjectService();
    const result = await projectService.submitDeveloperPayoutCompletion(projectId, developerUserId);
    return !!result;
  }

  async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const r = await ProjectTaskModel.findByIdAndDelete(id);
    return !!r;
  }
}
