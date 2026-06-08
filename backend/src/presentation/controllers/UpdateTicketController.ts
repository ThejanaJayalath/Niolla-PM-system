import { Response } from 'express';
import mongoose from 'mongoose';
import { UpdateTicketService } from '../../application/services/UpdateTicketService';
import { AuthenticatedRequest } from '../middleware/auth';
import { UpdateTicketStatus } from '../../domain/entities/UpdateTicket';

const updateTicketService = new UpdateTicketService();

export async function listMyUpdateTicketAssignments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  if (req.user?.role !== 'employee') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'For workers only' } });
    return;
  }
  const tickets = await updateTicketService.findAssignedForWorker(userId);
  res.json({ success: true, data: tickets });
}

export async function workerCompleteUpdateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId || req.user?.role !== 'employee') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'For workers only' } });
      return;
    }
    const ticket = await updateTicketService.workerComplete(req.params.id, userId);
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to complete update';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function listUpdateTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  const status = req.query.status as UpdateTicketStatus | undefined;
  const customerRef = req.query.customerRef as string | undefined;
  const projectRef = req.query.projectRef as string | undefined;
  const search = req.query.search as string | undefined;
  const tickets = await updateTicketService.findAll({ status, customerRef, projectRef, search });
  res.json({ success: true, data: tickets });
}

export async function getUpdateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  const ticket = await updateTicketService.findById(req.params.id);
  if (!ticket) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
    return;
  }
  res.json({ success: true, data: ticket });
}

export async function createUpdateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await updateTicketService.create({
      customerRef: req.body.customerRef,
      projectRef: req.body.projectRef,
      title: req.body.title,
      description: req.body.description,
      internalNotes: req.body.internalNotes,
      createdBy: req.user?.userId,
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create update ticket';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function setUpdateTicketPrice(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const quotedPrice = Number(req.body.quotedPrice);
    const ticket = await updateTicketService.setPrice(req.params.id, quotedPrice, req.user?.userId);
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to set price';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function approveUpdateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await updateTicketService.approveCustomer(req.params.id, req.user?.userId);
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record approval';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function assignUpdateTicketDevelopers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const assignedEmployeeIds = Array.isArray(req.body.assignedEmployeeIds)
      ? (req.body.assignedEmployeeIds as string[])
      : req.body.workerId && mongoose.Types.ObjectId.isValid(req.body.workerId)
        ? [req.body.workerId as string]
        : [];
    const rawPayout =
      req.body.workerPayoutValue !== undefined && req.body.workerPayoutValue !== null
        ? Number(req.body.workerPayoutValue)
        : req.body.developerPayoutValue !== undefined && req.body.developerPayoutValue !== null
          ? Number(req.body.developerPayoutValue)
          : NaN;
    const ticket = await updateTicketService.assignWorkers(
      req.params.id,
      assignedEmployeeIds,
      rawPayout,
      req.user?.userId
    );
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to assign worker';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function createUpdateTicketBilling(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await updateTicketService.createBilling(req.params.id, {
      downPaymentPct: Number(req.body.downPaymentPct),
      totalInstallments: Number(req.body.totalInstallments),
      serviceFeePct: req.body.serviceFeePct !== undefined ? Number(req.body.serviceFeePct) : undefined,
      planStartDate: req.body.planStartDate,
    });
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create billing';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function listPendingReviewUpdateTickets(req: AuthenticatedRequest, res: Response): Promise<void> {
  const tickets = await updateTicketService.findPendingReview();
  res.json({ success: true, data: tickets });
}

export async function approveUpdateCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await updateTicketService.approveWorkerCompletion(req.params.id, req.user?.userId);
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to approve update';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function completeUpdateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await updateTicketService.markCompleted(req.params.id);
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to complete ticket';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function cancelUpdateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await updateTicketService.cancel(req.params.id);
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel ticket';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function updateUpdateTicket(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const ticket = await updateTicketService.update(req.params.id, {
      title: req.body.title,
      description: req.body.description,
      internalNotes: req.body.internalNotes,
      status: req.body.status,
    });
    if (!ticket) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Update ticket not found' } });
      return;
    }
    res.json({ success: true, data: ticket });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update ticket';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}
