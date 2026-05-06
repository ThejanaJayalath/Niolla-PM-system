import mongoose from 'mongoose';
import { Project } from '../../domain/entities/Project';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { PaymentNotificationService } from './PaymentNotificationService';

export interface CreateProjectInput {
  clientId: string;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed' | 'cancelled';
}

export interface UpdateProjectInput {
  projectName?: string;
  description?: string;
  systemType?: string;
  totalValue?: number;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'completed' | 'cancelled';
  assignedEmployees?: string[];
}

export interface ListProjectsFilters {
  clientId?: string;
  status?: string;
  search?: string;
}

const ASSIGNMENT_MESSAGE = (projectName: string) =>
  `You are assigned to ${projectName}. Read the attached Proposal for full details.`;

export class ProjectService {
  private paymentNotificationService = new PaymentNotificationService();

  async create(data: CreateProjectInput): Promise<Project> {
    const doc = await ProjectModel.create({
      clientId: data.clientId,
      projectName: data.projectName.trim(),
      description: data.description?.trim() || undefined,
      systemType: data.systemType?.trim() || undefined,
      totalValue: Number(data.totalValue),
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      status: data.status || 'active',
    });
    return this.toProject(doc);
  }

  async findById(id: string): Promise<Project | null> {
    const doc = await ProjectModel.findById(id).populate('clientId', 'name customerId');
    return doc ? this.toProject(doc) : null;
  }

  async findByClientId(clientId: string): Promise<Project[]> {
    const docs = await ProjectModel.find({ clientId }).populate('clientId', 'name customerId').sort({ createdAt: -1 });
    return docs.map((d) => this.toProject(d));
  }

  async findAll(filters?: ListProjectsFilters): Promise<Project[]> {
    const query: Record<string, unknown> = {};
    if (filters?.clientId) query.clientId = filters.clientId;
    if (filters?.status) query.status = filters.status;
    if (filters?.search?.trim()) {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [{ projectName: searchRegex }, { description: searchRegex }, { systemType: searchRegex }];
    }
    const docs = await ProjectModel.find(query).populate('clientId', 'name customerId').sort({ createdAt: -1 });
    return docs.map((d) => this.toProject(d));
  }

  async update(id: string, data: UpdateProjectInput): Promise<Project | null> {
    const existingDoc = await ProjectModel.findById(id).select('assignedEmployees projectName').lean();
    if (!existingDoc) return null;

    const prevAssigneeIds = (existingDoc.assignedEmployees ?? []).map((oid) => oid.toString());

    const update: Record<string, unknown> = {};
    if (data.projectName !== undefined) update.projectName = data.projectName.trim();
    if (data.description !== undefined) update.description = data.description?.trim() || undefined;
    if (data.systemType !== undefined) update.systemType = data.systemType?.trim() || undefined;
    if (data.totalValue !== undefined) update.totalValue = Number(data.totalValue);
    if (data.startDate !== undefined) update.startDate = data.startDate ? new Date(data.startDate) : undefined;
    if (data.endDate !== undefined) update.endDate = data.endDate ? new Date(data.endDate) : undefined;
    if (data.status !== undefined) update.status = data.status;

    let addedUserIds: string[] = [];
    if (data.assignedEmployees !== undefined) {
      update.assignedEmployees = data.assignedEmployees.map((eid) => new mongoose.Types.ObjectId(eid));
      const newIds = data.assignedEmployees.map(String);
      addedUserIds = newIds.filter((eid) => !prevAssigneeIds.includes(eid));
    }

    const doc = await ProjectModel.findByIdAndUpdate(id, update, { new: true }).populate('clientId', 'name customerId');
    if (!doc) return null;

    if (addedUserIds.length > 0) {
      await this.notifyNewAssignees(addedUserIds, doc.projectName);
    }

    return this.toProject(doc);
  }

  async delete(id: string): Promise<boolean> {
    const result = await ProjectModel.findByIdAndDelete(id);
    return !!result;
  }

  private async notifyNewAssignees(userIds: string[], projectName: string): Promise<void> {
    const messageBody = ASSIGNMENT_MESSAGE(projectName);
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select('email phone')
      .lean();

    for (const u of users) {
      const uid = u._id.toString();
      const email = (u.email || '').trim();
      const phone = (u.phone || '').trim();
      if (phone) {
        await this.paymentNotificationService.create({
          userId: uid,
          type: 'sms',
          triggerType: 'assignment',
          scheduledAt: new Date(),
          messageBody,
        });
      }
      if (email) {
        await this.paymentNotificationService.create({
          userId: uid,
          type: 'email',
          triggerType: 'assignment',
          scheduledAt: new Date(),
          messageBody,
        });
      }
      if (!phone && !email) {
        await this.paymentNotificationService.create({
          userId: uid,
          type: 'system',
          triggerType: 'assignment',
          scheduledAt: new Date(),
          messageBody,
        });
      }
    }
  }

  private toProject(doc: { toObject: () => Record<string, unknown> }): Project {
    const o = doc.toObject();
    const clientIdObj = o.clientId as { _id?: unknown; name?: string; customerId?: string } | null;
    const project: Project = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      clientId:
        clientIdObj && typeof clientIdObj === 'object' && clientIdObj._id
          ? (clientIdObj._id as { toString: () => string }).toString()
          : (o.clientId as string),
      projectName: o.projectName as string,
      description: o.description as string | undefined,
      systemType: o.systemType as string | undefined,
      totalValue: Number(o.totalValue),
      startDate: o.startDate as Date | undefined,
      endDate: o.endDate as Date | undefined,
      status: o.status as 'active' | 'completed' | 'cancelled',
      createdAt: o.createdAt as Date,
      updatedAt: o.updatedAt as Date,
    };
    if (Array.isArray(o.assignedEmployees)) {
      project.assignedEmployees = (
        o.assignedEmployees as Array<{ _id?: { toString: () => string } } | mongoose.Types.ObjectId | string>
      ).map((entry) => {
        if (entry && typeof entry === 'object' && '_id' in entry && entry._id) {
          return entry._id.toString();
        }
        if (entry && typeof entry === 'object' && 'toString' in entry) {
          return (entry as { toString: () => string }).toString();
        }
        return String(entry);
      });
    }
    if (clientIdObj && typeof clientIdObj === 'object' && clientIdObj.name) {
      (project as Project & { clientName?: string }).clientName = clientIdObj.name;
    }
    return project;
  }
}
