import { Response } from 'express';
import { CallMeta, InteractionType } from '../../domain/entities/Interaction';
import { CustomerService } from '../../application/services/CustomerService';
import { InteractionService } from '../../application/services/InteractionService';
import { CustomerRequirementService } from '../../application/services/CustomerRequirementService';
import { UpdateTicketService } from '../../application/services/UpdateTicketService';
import { AuthenticatedRequest } from '../middleware/auth';

const customerService = new CustomerService();
const interactionService = new InteractionService();
const customerRequirementService = new CustomerRequirementService();
const updateTicketService = new UpdateTicketService();

async function ensureCustomerExists(customerId: string, res: Response): Promise<boolean> {
  const customer = await customerService.findById(customerId);
  if (!customer) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return false;
  }
  return true;
}

export async function listCustomerInteractions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  if (!await ensureCustomerExists(customerId, res)) return;

  const type = req.query.type as InteractionType | undefined;
  const items = await interactionService.findByCustomer(customerId, type);
  res.json({ success: true, data: items });
}

export async function createCustomerInteraction(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  if (!await ensureCustomerExists(customerId, res)) return;

  const interaction = await interactionService.create({
    customerRef: customerId,
    inquiryRef: req.body.inquiryRef,
    type: req.body.type,
    summary: req.body.summary,
    details: req.body.details,
    occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : undefined,
    createdBy: req.user?.userId,
    callMeta: req.body.callMeta,
  });
  res.status(201).json({ success: true, data: interaction });
}

export async function updateInteraction(req: AuthenticatedRequest, res: Response): Promise<void> {
  const interaction = await interactionService.update(req.params.interactionId, {
    summary: req.body.summary,
    details: req.body.details,
    occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : undefined,
    callMeta: req.body.callMeta,
  });
  if (!interaction) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Interaction not found' } });
    return;
  }
  res.json({ success: true, data: interaction });
}

export async function listCustomerCallLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  if (!await ensureCustomerExists(customerId, res)) return;

  const items = await interactionService.findByCustomer(customerId, 'CALL');
  res.json({ success: true, data: items });
}

export async function createCustomerCallLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  if (!await ensureCustomerExists(customerId, res)) return;

  const interaction = await interactionService.create({
    customerRef: customerId,
    inquiryRef: req.body.inquiryRef,
    type: 'CALL',
    summary: req.body.summary,
    details: req.body.details,
    occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : undefined,
    createdBy: req.user?.userId,
    callMeta: req.body.callMeta,
  });
  res.status(201).json({ success: true, data: interaction });
}

function mergeCallMetaForUpdate(prev: CallMeta | undefined, bodyMeta: CallMeta | undefined): CallMeta | undefined {
  if (bodyMeta === undefined) return undefined;
  const prevMeta = prev || {};
  const callMeta: CallMeta = {};
  if (prevMeta.nextFollowUpAt !== undefined && prevMeta.nextFollowUpAt !== null) {
    const d = prevMeta.nextFollowUpAt instanceof Date ? prevMeta.nextFollowUpAt : new Date(String(prevMeta.nextFollowUpAt));
    callMeta.nextFollowUpAt = d;
  }
  callMeta.direction = bodyMeta.direction ?? prevMeta.direction;
  callMeta.outcome = bodyMeta.outcome ?? prevMeta.outcome;
  if (Object.prototype.hasOwnProperty.call(bodyMeta, 'nextFollowUpAt')) {
    callMeta.nextFollowUpAt = bodyMeta.nextFollowUpAt
      ? (bodyMeta.nextFollowUpAt instanceof Date ? bodyMeta.nextFollowUpAt : new Date(String(bodyMeta.nextFollowUpAt)))
      : undefined;
  }
  if (Object.prototype.hasOwnProperty.call(bodyMeta, 'durationSec') && bodyMeta.durationSec != null && Number.isFinite(Number(bodyMeta.durationSec))) {
    callMeta.durationSec = Math.max(0, Number(bodyMeta.durationSec));
  }
  return callMeta;
}

export async function updateCustomerCallLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  const interactionId = req.params.interactionId;
  if (!await ensureCustomerExists(customerId, res)) return;

  const existing = await interactionService.findById(interactionId);
  if (!existing || existing.customerRef !== customerId || existing.type !== 'CALL') {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call log not found' } });
    return;
  }

  const mergedCallMeta = mergeCallMetaForUpdate(existing.callMeta, req.body.callMeta);
  const interaction = await interactionService.update(interactionId, {
    summary: req.body.summary !== undefined ? String(req.body.summary).trim() : undefined,
    details: req.body.details !== undefined ? (req.body.details ? String(req.body.details).trim() : '') : undefined,
    occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : undefined,
    ...(mergedCallMeta !== undefined ? { callMeta: mergedCallMeta } : {}),
  });
  if (!interaction) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call log not found' } });
    return;
  }
  res.json({ success: true, data: interaction });
}

export async function deleteCustomerCallLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  const interactionId = req.params.interactionId;
  if (!await ensureCustomerExists(customerId, res)) return;

  const existing = await interactionService.findById(interactionId);
  if (!existing || existing.customerRef !== customerId || existing.type !== 'CALL') {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call log not found' } });
    return;
  }

  const deleted = await interactionService.delete(interactionId);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call log not found' } });
    return;
  }
  res.json({ success: true });
}

export async function listCustomerRequirements(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  if (!await ensureCustomerExists(customerId, res)) return;

  const items = await customerRequirementService.findByCustomer(customerId);
  res.json({ success: true, data: items });
}

export async function createCustomerRequirement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  if (!await ensureCustomerExists(customerId, res)) return;

  const requirement = await customerRequirementService.create({
    customerRef: customerId,
    inquiryRef: req.body.inquiryRef,
    projectRef: req.body.projectRef,
    title: req.body.title,
    description: req.body.description,
    priority: req.body.priority,
    status: req.body.status,
    source: req.body.source,
    capturedAt: req.body.capturedAt ? new Date(req.body.capturedAt) : undefined,
    capturedBy: req.user?.userId,
    requirementPayoutValue:
      req.body.requirementPayoutValue !== undefined && req.body.requirementPayoutValue !== null
        ? Number(req.body.requirementPayoutValue)
        : undefined,
  });
  res.status(201).json({ success: true, data: requirement });
}

export async function updateRequirement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const existing = await customerRequirementService.findById(req.params.requirementId);
  if (!existing) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Requirement not found' } });
    return;
  }

  if (req.user?.role === 'employee' && req.user.userId) {
    const assigned = (existing.assignedEmployeeIds || []).map(String).includes(req.user.userId);
    const body = req.body as Record<string, unknown>;
    const keys = Object.keys(body).filter((k) => body[k] !== undefined);
    const onlyMarkDone =
      keys.length === 1 && keys[0] === 'status' && body.status === 'DONE' && existing.status !== 'DONE';
    if (!assigned || !onlyMarkDone) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Developers may only mark assigned requirements as done.' },
      });
      return;
    }
    const requirement = await customerRequirementService.update(req.params.requirementId, { status: 'DONE' });
    await updateTicketService.completeByLinkedRequirement(req.params.requirementId, req.user.userId);
    res.json({ success: true, data: requirement });
    return;
  }

  const requirementPayoutValue =
    req.body.requirementPayoutValue === undefined
      ? undefined
      : req.body.requirementPayoutValue === null
        ? null
        : Number(req.body.requirementPayoutValue);

  const requirement = await customerRequirementService.update(req.params.requirementId, {
    title: req.body.title,
    description: req.body.description,
    priority: req.body.priority,
    status: req.body.status,
    source: req.body.source,
    assignedEmployeeIds: Array.isArray(req.body.assignedEmployeeIds)
      ? (req.body.assignedEmployeeIds as string[])
      : undefined,
    ...(requirementPayoutValue !== undefined ? { requirementPayoutValue } : {}),
  });
  if (!requirement) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Requirement not found' } });
    return;
  }
  res.json({ success: true, data: requirement });
}

export async function deleteCustomerRequirement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = req.params.id;
  const requirementId = req.params.requirementId;
  if (!await ensureCustomerExists(customerId, res)) return;

  const existing = await customerRequirementService.findById(requirementId);
  if (!existing || existing.customerRef !== customerId) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Requirement not found' } });
    return;
  }

  const deleted = await customerRequirementService.delete(requirementId);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Requirement not found' } });
    return;
  }
  res.json({ success: true });
}
