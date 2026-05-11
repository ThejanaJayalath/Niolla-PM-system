import mongoose from 'mongoose';
import {
  CustomerRequirement,
  RequirementPriority,
  RequirementSource,
  RequirementStatus,
} from '../../domain/entities/CustomerRequirement';
import { CustomerRequirementModel } from '../../infrastructure/database/models/CustomerRequirementModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';

export interface CreateCustomerRequirementInput {
  customerRef: string;
  inquiryRef?: string;
  projectRef?: string;
  title: string;
  description?: string;
  priority?: RequirementPriority;
  status?: RequirementStatus;
  source?: RequirementSource;
  capturedAt?: Date;
  capturedBy?: string;
  requirementPayoutValue?: number;
}

export interface UpdateCustomerRequirementInput {
  title?: string;
  description?: string;
  priority?: RequirementPriority;
  status?: RequirementStatus;
  source?: RequirementSource;
  assignedEmployeeIds?: string[];
  requirementPayoutValue?: number | null;
}

export class CustomerRequirementService {
  async create(data: CreateCustomerRequirementInput): Promise<CustomerRequirement> {
    const { requirementPayoutValue: rpv, ...rest } = data;
    const doc = await CustomerRequirementModel.create({
      ...rest,
      priority: data.priority || 'MEDIUM',
      status: data.status || 'OPEN',
      source: data.source || 'MANUAL',
      capturedAt: data.capturedAt || new Date(),
      assignedEmployeeIds: [],
      ...(rpv !== undefined && Number.isFinite(Number(rpv))
        ? { requirementPayoutValue: Math.max(0, Number(rpv)) }
        : {}),
    });
    const out = this.toRequirement(doc.toObject() as unknown as Record<string, unknown>);
    if (data.projectRef) await this.refreshWorkflowLabelForProject(data.projectRef);
    return out;
  }

  async findById(id: string): Promise<CustomerRequirement | null> {
    const doc = await CustomerRequirementModel.findById(id);
    return doc ? this.toRequirement(doc.toObject() as unknown as Record<string, unknown>) : null;
  }

  async findByCustomer(customerId: string): Promise<CustomerRequirement[]> {
    const docs = await CustomerRequirementModel.find({ customerRef: customerId }).sort({
      capturedAt: -1,
      createdAt: -1,
    });
    return docs.map((doc) => this.toRequirement(doc.toObject() as unknown as Record<string, unknown>));
  }

  async findByProjectRef(projectId: string): Promise<CustomerRequirement[]> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) return [];
    const docs = await CustomerRequirementModel.find({
      projectRef: new mongoose.Types.ObjectId(projectId),
    }).sort({ capturedAt: -1 });
    return docs.map((doc) => this.toRequirement(doc.toObject() as unknown as Record<string, unknown>));
  }

  /** Requirements linked to a project and assigned to this developer (for Tasks / portal). */
  async findAssignedRequirementsForEmployee(
    employeeId: string
  ): Promise<Array<CustomerRequirement & { projectName?: string }>> {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) return [];
    const eid = new mongoose.Types.ObjectId(employeeId);
    const docs = await CustomerRequirementModel.find({
      projectRef: { $exists: true, $ne: null },
      assignedEmployeeIds: eid,
    })
      .populate('projectRef', 'projectName')
      .sort({ updatedAt: -1, capturedAt: -1 })
      .lean();
    return docs.map((d) => {
      const req = this.toRequirement(d as unknown as Record<string, unknown>);
      const pr = d.projectRef as unknown;
      const projectName =
        pr && typeof pr === 'object' && pr !== null && 'projectName' in pr
          ? String((pr as { projectName?: string }).projectName)
          : undefined;
      return { ...req, projectName };
    });
  }

  /**
   * Sets developers on requirements for one project (admin workflow page).
   * Each requirement id must belong to the given project.
   */
  async setRequirementAssigneesForProject(
    projectId: string,
    assignments: Record<string, string[]>,
    payoutValues?: Record<string, number | null | undefined>
  ): Promise<CustomerRequirement[]> {
    if (!mongoose.Types.ObjectId.isValid(projectId)) return [];
    const pid = new mongoose.Types.ObjectId(projectId);
    for (const [reqId, ids] of Object.entries(assignments)) {
      if (!mongoose.Types.ObjectId.isValid(reqId)) continue;
      const oids = (ids || [])
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      await CustomerRequirementModel.updateOne(
        { _id: new mongoose.Types.ObjectId(reqId), projectRef: pid },
        { $set: { assignedEmployeeIds: oids, lastUpdatedAt: new Date() } }
      );
    }
    if (payoutValues && typeof payoutValues === 'object' && !Array.isArray(payoutValues)) {
      for (const [reqId, raw] of Object.entries(payoutValues)) {
        if (!mongoose.Types.ObjectId.isValid(reqId)) continue;
        const n = raw === null || raw === undefined ? null : Number(raw);
        if (n === null || !Number.isFinite(n) || n < 0) {
          await CustomerRequirementModel.updateOne(
            { _id: new mongoose.Types.ObjectId(reqId), projectRef: pid },
            { $unset: { requirementPayoutValue: '' }, $set: { lastUpdatedAt: new Date() } }
          );
        } else {
          await CustomerRequirementModel.updateOne(
            { _id: new mongoose.Types.ObjectId(reqId), projectRef: pid },
            { $set: { requirementPayoutValue: n, lastUpdatedAt: new Date() } }
          );
        }
      }
    }
    await this.refreshWorkflowLabelForProject(projectId);
    return this.findByProjectRef(projectId);
  }

  async refreshWorkflowLabelForProject(projectId: string | undefined | null): Promise<void> {
    if (!projectId || !mongoose.Types.ObjectId.isValid(String(projectId))) return;
    const pid = new mongoose.Types.ObjectId(String(projectId));
    const reqs = await CustomerRequirementModel.find({ projectRef: pid }).lean();
    let label: 'none' | 'to_be_updated' | 'updated' = 'none';
    if (reqs.length === 0) {
      await ProjectModel.updateOne({ _id: pid }, { $set: { requirementWorkflowLabel: 'none' } });
      return;
    }
    const needsAssign = reqs.some((r) => !((r as { assignedEmployeeIds?: unknown[] }).assignedEmployeeIds || []).length);
    if (needsAssign) {
      label = 'to_be_updated';
    } else {
      const allDone = reqs.every((r) => r.status === 'DONE' || r.status === 'DEFERRED');
      label = allDone ? 'updated' : 'to_be_updated';
    }
    await ProjectModel.updateOne({ _id: pid }, { $set: { requirementWorkflowLabel: label } });
  }

  async update(id: string, data: UpdateCustomerRequirementInput): Promise<CustomerRequirement | null> {
    const $set: Record<string, unknown> = { lastUpdatedAt: new Date() };
    const $unset: Record<string, ''> = {};
    if (data.title !== undefined) $set.title = String(data.title).trim();
    if (data.description !== undefined) $set.description = data.description?.trim();
    if (data.priority !== undefined) $set.priority = data.priority;
    if (data.status !== undefined) $set.status = data.status;
    if (data.source !== undefined) $set.source = data.source;
    if (data.assignedEmployeeIds !== undefined) {
      $set.assignedEmployeeIds = data.assignedEmployeeIds
        .filter((x) => mongoose.Types.ObjectId.isValid(x))
        .map((x) => new mongoose.Types.ObjectId(x));
    }
    if (data.requirementPayoutValue !== undefined) {
      if (data.requirementPayoutValue === null || !Number.isFinite(Number(data.requirementPayoutValue))) {
        $unset.requirementPayoutValue = '';
      } else {
        $set.requirementPayoutValue = Math.max(0, Number(data.requirementPayoutValue));
      }
    }
    const mongoUpdate: Record<string, unknown> = { $set };
    if (Object.keys($unset).length > 0) mongoUpdate.$unset = $unset;
    const doc = await CustomerRequirementModel.findByIdAndUpdate(id, mongoUpdate, { new: true });
    const result = doc ? this.toRequirement(doc.toObject() as unknown as Record<string, unknown>) : null;
    if (result?.projectRef) await this.refreshWorkflowLabelForProject(result.projectRef);
    return result;
  }

  async delete(id: string): Promise<boolean> {
    const ex = await CustomerRequirementModel.findById(id).select('projectRef').lean();
    const pid = ex?.projectRef ? (ex.projectRef as mongoose.Types.ObjectId).toString() : undefined;
    const result = await CustomerRequirementModel.findByIdAndDelete(id);
    if (result && pid) await this.refreshWorkflowLabelForProject(pid);
    return !!result;
  }

  private toRequirement(o: Record<string, unknown>): CustomerRequirement {
    const assignedRaw = o.assignedEmployeeIds as mongoose.Types.ObjectId[] | undefined;
    const assignedEmployeeIds = Array.isArray(assignedRaw)
      ? assignedRaw.map((x) => (typeof x === 'object' && x && 'toString' in x ? x.toString() : String(x)))
      : undefined;
    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      customerRef: (o.customerRef as { toString: () => string })?.toString?.() || String(o.customerRef),
      inquiryRef: o.inquiryRef ? (o.inquiryRef as { toString: () => string })?.toString?.() : undefined,
      projectRef: o.projectRef ? (o.projectRef as { toString: () => string })?.toString?.() : undefined,
      assignedEmployeeIds: assignedEmployeeIds && assignedEmployeeIds.length > 0 ? assignedEmployeeIds : undefined,
      requirementPayoutValue: (() => {
        const v = o.requirementPayoutValue;
        if (v === undefined || v === null) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      })(),
      title: o.title as string,
      description: o.description as string | undefined,
      priority: o.priority as RequirementPriority,
      status: o.status as RequirementStatus,
      source: o.source as RequirementSource,
      capturedAt: o.capturedAt as Date,
      capturedBy: o.capturedBy ? (o.capturedBy as { toString: () => string })?.toString?.() : undefined,
      lastUpdatedAt: o.lastUpdatedAt as Date | undefined,
      createdAt: o.createdAt as Date | undefined,
      updatedAt: o.updatedAt as Date | undefined,
    };
  }
}
