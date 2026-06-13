import mongoose from 'mongoose';
import { UpdateTicket, UpdateTicketStatus } from '../../domain/entities/UpdateTicket';
import { UpdateTicketModel } from '../../infrastructure/database/models/UpdateTicketModel';
import { ProjectTaskModel } from '../../infrastructure/database/models/ProjectTaskModel';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { CustomerRequirementService } from './CustomerRequirementService';
import { PaymentPlanService } from './PaymentPlanService';
import { PaymentNotificationService } from './PaymentNotificationService';
import { ExpenseService } from './ExpenseService';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { EmailService } from '../../infrastructure/email/EmailService';
import { WhatsAppService } from '../../infrastructure/whatsapp/WhatsAppService';
import {
  DeveloperWalletLedgerModel,
  ensureWalletLedgerWalletStatusMigrated,
} from '../../infrastructure/database/models/DeveloperWalletLedgerModel';

const CLIENT_UPDATE_COMPLETE_MSG =
  'Your update has been successfully completed. Thank you for choosing NIOLLA Solutions!';

export interface CreateUpdateTicketInput {
  customerRef: string;
  projectRef: string;
  title: string;
  description?: string;
  internalNotes?: string;
  createdBy?: string;
}

export interface UpdateUpdateTicketInput {
  title?: string;
  description?: string;
  internalNotes?: string;
  status?: UpdateTicketStatus;
}

export interface ListUpdateTicketsFilters {
  status?: UpdateTicketStatus;
  customerRef?: string;
  projectRef?: string;
  search?: string;
}

export interface CreateUpdateTicketBillingInput {
  downPaymentPct: number;
  totalInstallments: number;
  serviceFeePct?: number;
  planStartDate?: string;
}

export class UpdateTicketService {
  private customerRequirementService = new CustomerRequirementService();
  private paymentPlanService = new PaymentPlanService();
  private paymentNotificationService = new PaymentNotificationService();
  private expenseService = new ExpenseService();
  private emailService = new EmailService();
  private whatsAppService = new WhatsAppService();

  private async getNextTicketId(): Promise<string> {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `UPD-${y}${m}-`;
    const docs = await UpdateTicketModel.find({ ticketId: new RegExp(`^${prefix}`) })
      .select('ticketId')
      .lean();
    let max = 0;
    for (const d of docs) {
      const tail = d.ticketId.slice(prefix.length);
      const n = parseInt(tail, 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  }

  private async assertProjectBelongsToCustomer(customerRef: string, projectRef: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(customerRef) || !mongoose.Types.ObjectId.isValid(projectRef)) {
      throw new Error('Invalid customer or project');
    }
    const [customer, project] = await Promise.all([
      CustomerModel.findById(customerRef).select('_id name'),
      ProjectModel.findById(projectRef).select('clientId projectName'),
    ]);
    if (!customer) throw new Error('Customer not found');
    if (!project) throw new Error('Project not found');
    if (String(project.clientId) !== String(customer._id)) {
      throw new Error('Project does not belong to this customer');
    }
  }

  async create(data: CreateUpdateTicketInput): Promise<UpdateTicket> {
    await this.assertProjectBelongsToCustomer(data.customerRef, data.projectRef);
    const ticketId = await this.getNextTicketId();
    const doc = await UpdateTicketModel.create({
      ticketId,
      customerRef: new mongoose.Types.ObjectId(data.customerRef),
      projectRef: new mongoose.Types.ObjectId(data.projectRef),
      title: data.title.trim(),
      description: data.description?.trim() || undefined,
      internalNotes: data.internalNotes?.trim() || undefined,
      status: 'REQUESTED',
      requestedAt: new Date(),
      createdBy: data.createdBy && mongoose.Types.ObjectId.isValid(data.createdBy)
        ? new mongoose.Types.ObjectId(data.createdBy)
        : undefined,
    });
    const populated = await this.populateOne(doc._id);
    return populated!;
  }

  async findById(id: string): Promise<UpdateTicket | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return this.populateOne(id);
  }

  async findAll(filters?: ListUpdateTicketsFilters): Promise<UpdateTicket[]> {
    const query: Record<string, unknown> = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.customerRef && mongoose.Types.ObjectId.isValid(filters.customerRef)) {
      query.customerRef = new mongoose.Types.ObjectId(filters.customerRef);
    }
    if (filters?.projectRef && mongoose.Types.ObjectId.isValid(filters.projectRef)) {
      query.projectRef = new mongoose.Types.ObjectId(filters.projectRef);
    }
    if (filters?.search?.trim()) {
      const rx = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [{ ticketId: rx }, { title: rx }, { description: rx }];
    }
    const docs = await UpdateTicketModel.find(query)
      .populate('customerRef', 'name customerId')
      .populate({
        path: 'projectRef',
        select: 'projectName systemType productId',
        populate: { path: 'productId', select: 'name code' },
      })
      .populate('createdBy', 'name')
      .populate('pricedBy', 'name')
      .populate('approvedBy', 'name')
      .populate('assignedBy', 'name')
      .populate('assignedEmployeeIds', 'name')
      .populate('completedByWorker', 'name')
      .populate('adminApprovedBy', 'name')
      .sort({ requestedAt: -1, createdAt: -1 })
      .lean();
    return docs.map((d) => this.toTicket(d as unknown as Record<string, unknown>));
  }

  async setPrice(id: string, quotedPrice: number, pricedBy?: string): Promise<UpdateTicket | null> {
    if (!Number.isFinite(quotedPrice) || quotedPrice < 0) {
      throw new Error('quotedPrice must be a non-negative number');
    }
    const existing = await UpdateTicketModel.findById(id);
    if (!existing) return null;
    if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED' || existing.status === 'PENDING_REVIEW') {
      throw new Error('Cannot price a cancelled, completed, or review-pending ticket');
    }
    existing.quotedPrice = quotedPrice;
    existing.pricedAt = new Date();
    existing.status = 'PRICED';
    if (pricedBy && mongoose.Types.ObjectId.isValid(pricedBy)) {
      existing.pricedBy = new mongoose.Types.ObjectId(pricedBy);
    }
    await existing.save();
    return this.populateOne(id);
  }

  /** Record customer approval of the quoted price. Creates a linked requirement for dev workflow. */
  async approveCustomer(id: string, approvedBy?: string): Promise<UpdateTicket | null> {
    const ticket = await UpdateTicketModel.findById(id);
    if (!ticket) return null;
    if (ticket.status !== 'PRICED') {
      throw new Error('Customer can only approve after a price has been set');
    }
    if (!ticket.quotedPrice || ticket.quotedPrice <= 0) {
      throw new Error('Set a quoted price before recording approval');
    }

    if (!ticket.linkedRequirementId) {
      const req = await this.customerRequirementService.create({
        customerRef: ticket.customerRef.toString(),
        projectRef: ticket.projectRef.toString(),
        title: `[Update] ${ticket.title}`,
        description: ticket.description,
        source: 'CUSTOMER',
        status: 'OPEN',
        capturedBy: approvedBy,
      });
      if (req._id) {
        ticket.linkedRequirementId = new mongoose.Types.ObjectId(req._id);
      }
    }

    ticket.status = 'APPROVED';
    ticket.approvedAt = new Date();
    if (approvedBy && mongoose.Types.ObjectId.isValid(approvedBy)) {
      ticket.approvedBy = new mongoose.Types.ObjectId(approvedBy);
    }
    await ticket.save();
    await this.customerRequirementService.refreshWorkflowLabelForProject(ticket.projectRef.toString());
    return this.populateOne(id);
  }

  /** Assign worker(s) to the update task and record worker payout for this ticket. */
  async assignWorkers(
    id: string,
    assignedEmployeeIds: string[],
    workerPayoutValue: number,
    assignedBy?: string
  ): Promise<UpdateTicket | null> {
    const ticket = await UpdateTicketModel.findById(id);
    if (!ticket) return null;
    if (!['APPROVED', 'IN_PROGRESS'].includes(ticket.status)) {
      throw new Error('Assign a worker after customer approval');
    }
    if (!ticket.linkedRequirementId) {
      throw new Error('Linked requirement missing — approve the ticket first');
    }

    const oids = assignedEmployeeIds
      .filter((eid) => mongoose.Types.ObjectId.isValid(eid))
      .map((eid) => new mongoose.Types.ObjectId(eid));
    if (oids.length === 0) {
      throw new Error('Select a worker to assign');
    }
    if (!Number.isFinite(workerPayoutValue) || workerPayoutValue < 0) {
      throw new Error('Worker payout must be a non-negative amount (LKR)');
    }

    const payout = Math.max(0, workerPayoutValue);
    ticket.assignedEmployeeIds = oids;
    ticket.developerPayoutValue = payout;
    ticket.assignedAt = new Date();
    if (assignedBy && mongoose.Types.ObjectId.isValid(assignedBy)) {
      ticket.assignedBy = new mongoose.Types.ObjectId(assignedBy);
    }

    await this.customerRequirementService.update(ticket.linkedRequirementId.toString(), {
      assignedEmployeeIds: oids.map((o) => o.toString()),
      status: 'IN_PROGRESS',
      requirementPayoutValue: payout,
    });

    if (ticket.status === 'APPROVED') ticket.status = 'IN_PROGRESS';
    await this.upsertLinkedProjectTask(ticket, oids, assignedBy);
    await ticket.save();
    await this.customerRequirementService.refreshWorkflowLabelForProject(ticket.projectRef.toString());
    await this.notifyWorkersAssigned(ticket, oids.map((o) => o.toString()), payout);
    return this.populateOne(id);
  }

  /** Keep a project task in sync when a worker is assigned to an update ticket. */
  private async upsertLinkedProjectTask(
    ticket: {
      _id: mongoose.Types.ObjectId;
      ticketId: string;
      projectRef: mongoose.Types.ObjectId;
      title: string;
      description?: string;
      linkedRequirementId?: mongoose.Types.ObjectId;
      linkedProjectTaskId?: mongoose.Types.ObjectId;
    },
    assigneeOids: mongoose.Types.ObjectId[],
    assignedBy?: string
  ): Promise<void> {
    const taskTitle = `${ticket.ticketId}: ${ticket.title}`;
    const createdBy =
      assignedBy && mongoose.Types.ObjectId.isValid(assignedBy)
        ? new mongoose.Types.ObjectId(assignedBy)
        : assigneeOids[0];

    if (ticket.linkedProjectTaskId) {
      await ProjectTaskModel.findByIdAndUpdate(ticket.linkedProjectTaskId, {
        $set: {
          title: taskTitle,
          description: ticket.description,
          assigneeIds: assigneeOids,
          requirementId: ticket.linkedRequirementId,
          completed: false,
          completedAt: undefined,
          completedBy: undefined,
        },
      });
      return;
    }

    const task = await ProjectTaskModel.create({
      projectId: ticket.projectRef,
      requirementId: ticket.linkedRequirementId,
      updateTicketId: ticket._id,
      title: taskTitle,
      description: ticket.description,
      assigneeIds: assigneeOids,
      completed: false,
      createdBy,
    });
    ticket.linkedProjectTaskId = task._id;
  }

  /** @deprecated Use assignWorkers */
  async assignDevelopers(
    id: string,
    assignedEmployeeIds: string[],
    developerPayoutValue?: number
  ): Promise<UpdateTicket | null> {
    const payout =
      developerPayoutValue !== undefined && Number.isFinite(Number(developerPayoutValue))
        ? Number(developerPayoutValue)
        : NaN;
    return this.assignWorkers(id, assignedEmployeeIds, payout);
  }

  private async notifyWorkersAssigned(
    ticket: { title: string; ticketId: string; projectRef: mongoose.Types.ObjectId },
    userIds: string[],
    payout: number
  ): Promise<void> {
    try {
      const project = await ProjectModel.findById(ticket.projectRef).select('projectName').lean();
      const projectLabel = (project?.projectName as string | undefined)?.trim() || 'Project';
      const fmt = (n: number) =>
        Number.isFinite(n) ? n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '0';
      const users = await UserModel.find({ _id: { $in: userIds } }).select('_id').lean();
      const now = new Date();
      const messageBody = `Update task ${ticket.ticketId} on "${projectLabel}": ${ticket.title}. Your worker payout for this task is LKR ${fmt(payout)}. Check Tasks for details.`;
      for (const u of users) {
        await this.paymentNotificationService.create({
          userId: u._id.toString(),
          type: 'system',
          triggerType: 'assignment',
          scheduledAt: now,
          status: 'sent',
          sentAt: now,
          messageBody,
        });
      }
    } catch {
      /* non-fatal */
    }
  }

  /** Create add-on payment plan for the quoted update price. */
  async createBilling(id: string, input: CreateUpdateTicketBillingInput): Promise<UpdateTicket | null> {
    const ticket = await UpdateTicketModel.findById(id);
    if (!ticket) return null;
    if (!['APPROVED', 'IN_PROGRESS'].includes(ticket.status)) {
      throw new Error('Create billing after customer approval');
    }
    if (!ticket.quotedPrice || ticket.quotedPrice <= 0) {
      throw new Error('No quoted price on this ticket');
    }
    if (ticket.linkedPaymentPlanId) {
      throw new Error('Billing already created for this update ticket');
    }
    if (!ticket.linkedRequirementId) {
      throw new Error('Approve the ticket first to link a requirement');
    }

    const downPaymentPct = Number(input.downPaymentPct);
    const totalInstallments = Math.floor(Number(input.totalInstallments));
    if (!Number.isFinite(downPaymentPct) || downPaymentPct < 0 || downPaymentPct > 100) {
      throw new Error('downPaymentPct must be 0–100');
    }
    if (!Number.isFinite(totalInstallments) || totalInstallments < 1) {
      throw new Error('totalInstallments must be at least 1');
    }

    const plan = await this.paymentPlanService.createAddonPlanForRequirement({
      projectId: ticket.projectRef.toString(),
      requirementId: ticket.linkedRequirementId.toString(),
      totalValue: ticket.quotedPrice,
      downPaymentPct,
      totalInstallments,
      serviceFeePct: input.serviceFeePct,
      planStartDate: input.planStartDate,
    });

    ticket.linkedPaymentPlanId = new mongoose.Types.ObjectId(plan._id!);
    await ticket.save();
    return this.populateOne(id);
  }

  async findByLinkedRequirementId(requirementId: string): Promise<UpdateTicket | null> {
    if (!mongoose.Types.ObjectId.isValid(requirementId)) return null;
    const doc = await UpdateTicketModel.findOne({
      linkedRequirementId: new mongoose.Types.ObjectId(requirementId),
    }).select('_id');
    return doc ? this.populateOne(doc._id) : null;
  }

  async findAssignedForWorker(employeeId: string): Promise<UpdateTicket[]> {
    if (!mongoose.Types.ObjectId.isValid(employeeId)) return [];
    const eid = new mongoose.Types.ObjectId(employeeId);
    const needsLink = await UpdateTicketModel.find({
      assignedEmployeeIds: eid,
      status: { $in: ['APPROVED', 'IN_PROGRESS'] },
      linkedProjectTaskId: { $exists: false },
    });
    for (const ticket of needsLink) {
      if ((ticket.assignedEmployeeIds || []).length > 0) {
        await this.upsertLinkedProjectTask(
          ticket,
          ticket.assignedEmployeeIds as mongoose.Types.ObjectId[]
        );
        await ticket.save();
      }
    }
    const docs = await UpdateTicketModel.find({
      assignedEmployeeIds: eid,
      status: { $in: ['APPROVED', 'IN_PROGRESS'] },
      linkedProjectTaskId: { $exists: false },
    })
      .populate('customerRef', 'name customerId')
      .populate({
        path: 'projectRef',
        select: 'projectName systemType productId',
        populate: { path: 'productId', select: 'name code' },
      })
      .populate('assignedEmployeeIds', 'name')
      .populate('completedByWorker', 'name')
      .sort({ assignedAt: -1, requestedAt: -1 })
      .lean();
    return docs.map((d) => this.toTicket(d as unknown as Record<string, unknown>));
  }

  /** Worker marks their assigned update as completed from dashboard / tasks. */
  async workerComplete(id: string, workerId: string): Promise<UpdateTicket | null> {
    const ticket = await UpdateTicketModel.findById(id);
    if (!ticket) return null;
    if (!['APPROVED', 'IN_PROGRESS'].includes(ticket.status)) {
      throw new Error('This update is not open for completion');
    }
    const assigned = (ticket.assignedEmployeeIds || []).some((oid) => String(oid) === workerId);
    if (!assigned) {
      throw new Error('You are not assigned to this update');
    }

    ticket.status = 'PENDING_REVIEW';
    ticket.workerSubmittedAt = new Date();
    if (mongoose.Types.ObjectId.isValid(workerId)) {
      ticket.completedByWorker = new mongoose.Types.ObjectId(workerId);
    }

    if (ticket.linkedRequirementId) {
      await this.customerRequirementService.update(ticket.linkedRequirementId.toString(), { status: 'DONE' });
    }

    if (ticket.linkedProjectTaskId && mongoose.Types.ObjectId.isValid(workerId)) {
      await ProjectTaskModel.findByIdAndUpdate(ticket.linkedProjectTaskId, {
        $set: {
          completed: true,
          completedAt: new Date(),
          completedBy: new mongoose.Types.ObjectId(workerId),
        },
      });
    }

    await ticket.save();
    await this.customerRequirementService.refreshWorkflowLabelForProject(ticket.projectRef.toString());
    await this.notifyAdminsUpdateReadyForReview(ticket);
    return this.populateOne(id);
  }

  /** Admin reviews worker output and approves — closes the ticket and credits worker payout. */
  async approveWorkerCompletion(id: string, adminUserId?: string): Promise<UpdateTicket | null> {
    const ticket = await UpdateTicketModel.findById(id);
    if (!ticket) return null;
    if (ticket.status !== 'PENDING_REVIEW') {
      throw new Error('Only updates awaiting admin review can be approved');
    }

    const workerId = (ticket.assignedEmployeeIds || [])[0]?.toString();
    const payout = Number(ticket.developerPayoutValue);
    const now = new Date();

    ticket.status = 'COMPLETED';
    ticket.completedAt = now;
    ticket.adminApprovedAt = now;
    if (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) {
      ticket.adminApprovedBy = new mongoose.Types.ObjectId(adminUserId);
    }

    await ticket.save();

    if (workerId && Number.isFinite(payout) && payout > 0) {
      await this.creditWorkerWalletForApprovedUpdate(ticket, workerId, payout, now);
      await this.notifyWorkerUpdateApproved(ticket, workerId, payout);
      if (adminUserId && mongoose.Types.ObjectId.isValid(adminUserId)) {
        const project = await ProjectModel.findById(ticket.projectRef).select('projectName').lean();
        await this.expenseService.logAutomatedUpdatePayoutExpense({
          amount: payout,
          developerId: workerId,
          projectId: ticket.projectRef.toString(),
          projectName: (project?.projectName as string | undefined)?.trim() || 'Project',
          updateTicketId: String(ticket._id),
          ticketId: ticket.ticketId,
          ticketTitle: ticket.title,
          quotedPrice: ticket.quotedPrice,
          recordedByUserId: adminUserId,
        });
      }
    }

    await this.customerRequirementService.refreshWorkflowLabelForProject(ticket.projectRef.toString());
    await this.notifyCustomerUpdateCompleted(ticket);
    return this.populateOne(id);
  }

  /** Credit pre-defined worker payout to wallet + ledger when admin approves completed update. */
  private async creditWorkerWalletForApprovedUpdate(
    ticket: {
      _id: mongoose.Types.ObjectId;
      ticketId: string;
      projectRef: mongoose.Types.ObjectId;
      workerSubmittedAt?: Date;
    },
    workerId: string,
    payout: number,
    approvedAt: Date
  ): Promise<void> {
    await ensureWalletLedgerWalletStatusMigrated();
    const workerOid = new mongoose.Types.ObjectId(workerId);
    const existing = await DeveloperWalletLedgerModel.findOne({
      developerId: workerOid,
      updateTicketId: ticket._id,
      walletStatus: 'Available',
    }).lean();
    if (existing) return;

    const project = await ProjectModel.findById(ticket.projectRef).select('projectName').lean();
    const projectLabel = (project?.projectName as string | undefined)?.trim() || 'Project';
    const submittedAt = ticket.workerSubmittedAt || approvedAt;

    await UserModel.findByIdAndUpdate(workerId, { $inc: { walletBalance: payout } });
    await DeveloperWalletLedgerModel.findOneAndUpdate(
      { developerId: workerOid, updateTicketId: ticket._id },
      {
        $set: {
          projectId: ticket.projectRef,
          projectName: `${projectLabel} · ${ticket.ticketId}`,
          amount: payout,
          walletStatus: 'Available' as const,
          submittedAt,
          approvedAt,
        },
      },
      { upsert: true }
    );
  }

  async findPendingReview(): Promise<UpdateTicket[]> {
    return this.findAll({ status: 'PENDING_REVIEW' });
  }

  /** When a worker completes via linked requirement, sync the update ticket. */
  async completeByLinkedRequirement(requirementId: string, workerId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(requirementId)) return;
    const ticket = await UpdateTicketModel.findOne({
      linkedRequirementId: new mongoose.Types.ObjectId(requirementId),
      status: { $in: ['APPROVED', 'IN_PROGRESS'] },
    });
    if (!ticket) return;
    await this.workerComplete(String(ticket._id), workerId);
  }

  private async notifyAdminsUpdateReadyForReview(ticket: {
    ticketId: string;
    title: string;
    projectRef: mongoose.Types.ObjectId;
    developerPayoutValue?: number;
    completedByWorker?: mongoose.Types.ObjectId;
  }): Promise<void> {
    try {
      const [project, worker] = await Promise.all([
        ProjectModel.findById(ticket.projectRef).select('projectName').lean(),
        ticket.completedByWorker
          ? UserModel.findById(ticket.completedByWorker).select('name').lean()
          : Promise.resolve(null),
      ]);
      const projectLabel = (project?.projectName as string | undefined)?.trim() || 'Project';
      const workerName = (worker?.name as string | undefined)?.trim() || 'A worker';
      const payout =
        ticket.developerPayoutValue != null && Number(ticket.developerPayoutValue) > 0
          ? ` Worker payout: LKR ${Number(ticket.developerPayoutValue).toLocaleString()}.`
          : '';
      const admins = await UserModel.find({ role: { $in: ['owner', 'pm'] } }).select('_id').lean();
      const now = new Date();
      const messageBody = `Review request: ${workerName} completed update ${ticket.ticketId} on "${projectLabel}" — ${ticket.title}.${payout} Open Update Tickets and click Approve after checking the work.`;
      for (const admin of admins) {
        await this.paymentNotificationService.create({
          userId: admin._id.toString(),
          type: 'system',
          triggerType: 'status_notification',
          scheduledAt: now,
          status: 'sent',
          sentAt: now,
          messageBody,
        });
      }
    } catch {
      /* non-fatal */
    }
  }

  private async notifyWorkerUpdateApproved(
    ticket: { ticketId: string; title: string; projectRef: mongoose.Types.ObjectId },
    workerId: string,
    payout: number
  ): Promise<void> {
    try {
      const project = await ProjectModel.findById(ticket.projectRef).select('projectName').lean();
      const projectLabel = (project?.projectName as string | undefined)?.trim() || 'Project';
      const now = new Date();
      await this.paymentNotificationService.create({
        userId: workerId,
        type: 'system',
        triggerType: 'assignment',
        scheduledAt: now,
        status: 'sent',
        sentAt: now,
        messageBody: `Your update ${ticket.ticketId} on "${projectLabel}" was approved. LKR ${payout.toLocaleString()} credited to your wallet.`,
      });
    } catch {
      /* non-fatal */
    }
  }

  /** SMS/email to customer immediately after admin approves completed work. */
  private async notifyCustomerUpdateCompleted(ticket: {
    customerRef: mongoose.Types.ObjectId;
    ticketId: string;
    title: string;
  }): Promise<void> {
    try {
      const customer = await CustomerModel.findById(ticket.customerRef)
        .select('name email phoneNumber companyName')
        .lean();
      if (!customer?._id) return;

      const clientId = customer._id.toString();
      const displayName =
        (customer.name as string | undefined)?.trim() ||
        (customer.companyName as string | undefined)?.trim() ||
        'Valued customer';
      const message = CLIENT_UPDATE_COMPLETE_MSG;
      const now = new Date();

      const email = (customer.email as string | undefined)?.trim();
      if (email) {
        try {
          if (this.emailService.isConfigured()) {
            await this.emailService.send({
              to: email,
              subject: 'Your update is complete — NIOLLA Solutions',
              text: `Dear ${displayName},\n\n${message}`,
              html: `<p>Dear ${displayName},</p><p>${message}</p>`,
            });
            await this.paymentNotificationService.create({
              clientId,
              type: 'email',
              triggerType: 'status_notification',
              scheduledAt: now,
              status: 'sent',
              sentAt: now,
              messageBody: message,
            });
          } else {
            await this.paymentNotificationService.create({
              clientId,
              type: 'email',
              triggerType: 'status_notification',
              scheduledAt: now,
              status: 'pending',
              messageBody: message,
            });
          }
        } catch (err) {
          console.error('Update complete email failed:', err);
          await this.paymentNotificationService.create({
            clientId,
            type: 'email',
            triggerType: 'status_notification',
            scheduledAt: now,
            status: 'failed',
            messageBody: message,
          });
        }
      }

      const phone = (customer.phoneNumber as string | undefined)?.trim();
      if (phone) {
        try {
          const wa = await this.whatsAppService.sendMessage(phone, message);
          await this.paymentNotificationService.create({
            clientId,
            type: 'sms',
            triggerType: 'status_notification',
            scheduledAt: now,
            status: wa.sent ? 'sent' : 'pending',
            ...(wa.sent ? { sentAt: now } : {}),
            messageBody: message,
          });
        } catch (err) {
          console.error('Update complete SMS/WhatsApp failed:', err);
          await this.paymentNotificationService.create({
            clientId,
            type: 'sms',
            triggerType: 'status_notification',
            scheduledAt: now,
            status: 'failed',
            messageBody: message,
          });
        }
      }

      await this.paymentNotificationService.create({
        clientId,
        type: 'system',
        triggerType: 'status_notification',
        scheduledAt: now,
        status: 'sent',
        sentAt: now,
        messageBody: `${ticket.ticketId}: ${message}`,
      });
    } catch {
      /* non-fatal */
    }
  }

  async markCompleted(id: string): Promise<UpdateTicket | null> {
    const ticket = await UpdateTicketModel.findById(id);
    if (!ticket) return null;
    if (!['APPROVED', 'IN_PROGRESS'].includes(ticket.status)) {
      throw new Error('Only approved or in-progress tickets can be completed');
    }
    ticket.status = 'COMPLETED';
    ticket.completedAt = new Date();
    if (ticket.linkedRequirementId) {
      await this.customerRequirementService.update(ticket.linkedRequirementId.toString(), { status: 'DONE' });
    }
    await ticket.save();
    await this.customerRequirementService.refreshWorkflowLabelForProject(ticket.projectRef.toString());
    return this.populateOne(id);
  }

  async cancel(id: string): Promise<UpdateTicket | null> {
    const ticket = await UpdateTicketModel.findById(id);
    if (!ticket) return null;
    if (ticket.status === 'COMPLETED') {
      throw new Error('Completed tickets cannot be cancelled');
    }
    ticket.status = 'CANCELLED';
    await ticket.save();
    if (ticket.linkedRequirementId) {
      await this.customerRequirementService.update(ticket.linkedRequirementId.toString(), { status: 'DEFERRED' });
    }
    await this.customerRequirementService.refreshWorkflowLabelForProject(ticket.projectRef.toString());
    return this.populateOne(id);
  }

  async update(id: string, data: UpdateUpdateTicketInput): Promise<UpdateTicket | null> {
    const $set: Record<string, unknown> = {};
    if (data.title !== undefined) $set.title = String(data.title).trim();
    if (data.description !== undefined) $set.description = data.description?.trim() || undefined;
    if (data.internalNotes !== undefined) $set.internalNotes = data.internalNotes?.trim() || undefined;
    if (data.status !== undefined) $set.status = data.status;
    const doc = await UpdateTicketModel.findByIdAndUpdate(id, { $set }, { new: true });
    if (!doc) return null;
    return this.populateOne(id);
  }

  private async populateOne(id: mongoose.Types.ObjectId | string): Promise<UpdateTicket | null> {
    const doc = await UpdateTicketModel.findById(id)
      .populate('customerRef', 'name customerId')
      .populate({
        path: 'projectRef',
        select: 'projectName systemType productId',
        populate: { path: 'productId', select: 'name code' },
      })
      .populate('createdBy', 'name')
      .populate('pricedBy', 'name')
      .populate('approvedBy', 'name')
      .populate('assignedBy', 'name')
      .populate('assignedEmployeeIds', 'name')
      .populate('completedByWorker', 'name')
      .populate('adminApprovedBy', 'name')
      .lean();
    if (!doc) return null;
    return this.toTicket(doc as unknown as Record<string, unknown>);
  }

  private toTicket(o: Record<string, unknown>): UpdateTicket {
    const customer = o.customerRef as { _id?: { toString: () => string }; name?: string } | null;
    const projectRaw = o.projectRef as {
      _id?: { toString: () => string };
      projectName?: string;
      systemType?: string;
      productId?: { name?: string; code?: string } | null;
    } | null;
    const createdBy = o.createdBy as { _id?: { toString: () => string }; name?: string } | null;
    const pricedBy = o.pricedBy as { _id?: { toString: () => string }; name?: string } | null;
    const approvedBy = o.approvedBy as { _id?: { toString: () => string }; name?: string } | null;
    const assignedByUser = o.assignedBy as { _id?: { toString: () => string }; name?: string } | null;
    const completedByWorkerUser = o.completedByWorker as { _id?: { toString: () => string }; name?: string } | null;
    const adminApprovedByUser = o.adminApprovedBy as { _id?: { toString: () => string }; name?: string } | null;
    const assignedRaw = o.assignedEmployeeIds as Array<{ _id?: { toString: () => string }; name?: string }> | undefined;
    const assignees = Array.isArray(assignedRaw)
      ? assignedRaw
          .filter((a) => a && a._id)
          .map((a) => ({ _id: a._id!.toString(), name: a.name || 'Developer' }))
      : undefined;
    const assignedEmployeeIds = assignees?.map((a) => a._id);
    const product = projectRaw?.productId;

    const payoutVal =
      o.developerPayoutValue !== undefined && o.developerPayoutValue !== null
        ? Number(o.developerPayoutValue)
        : undefined;

    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      ticketId: o.ticketId as string,
      customerRef: customer?._id?.toString?.() || String(o.customerRef),
      customerName: customer?.name,
      projectRef: projectRaw?._id?.toString?.() || String(o.projectRef),
      projectName: projectRaw?.projectName,
      productName: product?.name || projectRaw?.systemType,
      title: o.title as string,
      description: o.description as string | undefined,
      status: o.status as UpdateTicket['status'],
      quotedPrice: o.quotedPrice !== undefined && o.quotedPrice !== null ? Number(o.quotedPrice) : undefined,
      pricedAt: o.pricedAt as Date | undefined,
      pricedBy: pricedBy?._id?.toString?.(),
      pricedByName: pricedBy?.name,
      approvedAt: o.approvedAt as Date | undefined,
      approvedBy: approvedBy?._id?.toString?.(),
      approvedByName: approvedBy?.name,
      assignedEmployeeIds,
      assignees,
      workerPayoutValue: payoutVal,
      developerPayoutValue: payoutVal,
      assignedAt: o.assignedAt as Date | undefined,
      assignedBy: assignedByUser?._id?.toString?.(),
      assignedByName: assignedByUser?.name,
      linkedRequirementId: o.linkedRequirementId
        ? (o.linkedRequirementId as { toString: () => string }).toString()
        : undefined,
      linkedPaymentPlanId: o.linkedPaymentPlanId
        ? (o.linkedPaymentPlanId as { toString: () => string }).toString()
        : undefined,
      linkedProjectTaskId: o.linkedProjectTaskId
        ? (o.linkedProjectTaskId as { toString: () => string }).toString()
        : undefined,
      requestedAt: o.requestedAt as Date,
      workerSubmittedAt: o.workerSubmittedAt as Date | undefined,
      completedAt: o.completedAt as Date | undefined,
      completedByWorker: completedByWorkerUser?._id?.toString?.(),
      completedByWorkerName: completedByWorkerUser?.name,
      adminApprovedAt: o.adminApprovedAt as Date | undefined,
      adminApprovedBy: adminApprovedByUser?._id?.toString?.(),
      adminApprovedByName: adminApprovedByUser?.name,
      createdBy: createdBy?._id?.toString?.(),
      createdByName: createdBy?.name,
      internalNotes: o.internalNotes as string | undefined,
      createdAt: o.createdAt as Date | undefined,
      updatedAt: o.updatedAt as Date | undefined,
    };
  }
}
