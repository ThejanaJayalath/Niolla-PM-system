import { Project } from '../../domain/entities/Project';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';

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
}

export interface ListProjectsFilters {
  clientId?: string;
  status?: string;
  search?: string;
}

export class ProjectService {
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
      query.$or = [
        { projectName: searchRegex },
        { description: searchRegex },
        { systemType: searchRegex },
      ];
    }
    const docs = await ProjectModel.find(query).populate('clientId', 'name customerId').sort({ createdAt: -1 });
    return docs.map((d) => this.toProject(d));
  }

  async update(id: string, data: UpdateProjectInput): Promise<Project | null> {
    const update: Record<string, unknown> = { ...data };
    if (data.projectName !== undefined) update.projectName = data.projectName.trim();
    if (data.description !== undefined) update.description = data.description?.trim() || undefined;
    if (data.systemType !== undefined) update.systemType = data.systemType?.trim() || undefined;
    if (data.totalValue !== undefined) update.totalValue = Number(data.totalValue);
    if (data.startDate !== undefined) update.startDate = data.startDate ? new Date(data.startDate) : undefined;
    if (data.endDate !== undefined) update.endDate = data.endDate ? new Date(data.endDate) : undefined;
    const doc = await ProjectModel.findByIdAndUpdate(id, update, { new: true }).populate('clientId', 'name customerId');
    return doc ? this.toProject(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ProjectModel.findByIdAndDelete(id);
    return !!result;
  }

  private toProject(doc: { toObject: () => Record<string, unknown> }): Project {
    const o = doc.toObject();
    const clientIdObj = o.clientId as { _id?: unknown; name?: string; customerId?: string } | null;
    const project: Project = {
      _id: (o._id as { toString: () => string })?.toString?.(),
      clientId: clientIdObj && typeof clientIdObj === 'object' && clientIdObj._id
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
    if (clientIdObj && typeof clientIdObj === 'object' && clientIdObj.name) {
      (project as Project & { clientName?: string }).clientName = clientIdObj.name;
    }
    return project;
  }
}
