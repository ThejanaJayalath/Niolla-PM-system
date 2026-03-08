import { Response } from 'express';
import { CustomerModel } from '../../infrastructure/database/models/CustomerModel';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { PaymentPlanModel } from '../../infrastructure/database/models/PaymentPlanModel';
import { PaymentTransactionModel } from '../../infrastructure/database/models/PaymentTransactionModel';
import { InstallmentModel } from '../../infrastructure/database/models/InstallmentModel';
import { AuthenticatedRequest } from '../middleware/auth';

export interface PaymentSummary {
  totalClients: number;
  totalProjectValue: number;
  totalCollected: number;
  pendingBalance: number;
  overdueCount: number;
  dueTodayCount: number;
}

export interface MonthlyCollectionResult {
  year: number;
  month: number;
  totalCollected: number;
  transactionCount: number;
}

export interface OverdueInstallmentRow {
  _id: string;
  planId: string;
  projectName?: string;
  clientName?: string;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  overdueDays: number;
}

export async function getPaymentSummary(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const [
      totalClients,
      projectValueResult,
      collectedResult,
      pendingResult,
      overdueCount,
      dueTodayCount,
    ] = await Promise.all([
      CustomerModel.countDocuments(),
      ProjectModel.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$totalValue' } } }]),
      PaymentTransactionModel.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      PaymentPlanModel.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$remainingBalance' } } }]),
      InstallmentModel.countDocuments({ status: 'overdue' }),
      (() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return InstallmentModel.countDocuments({
          status: { $in: ['pending', 'partial'] },
          dueDate: { $gte: start, $lt: end },
        });
      })(),
    ]);

    const summary: PaymentSummary = {
      totalClients,
      totalProjectValue: projectValueResult[0]?.total ?? 0,
      totalCollected: collectedResult[0]?.total ?? 0,
      pendingBalance: pendingResult[0]?.total ?? 0,
      overdueCount,
      dueTodayCount,
    };
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Report summary error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load summary';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getMonthlyCollection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const year = parseInt(req.query.year as string, 10);
    const month = parseInt(req.query.month as string, 10);
    if (!year || !month || month < 1 || month > 12) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'year and month (1-12) are required' } });
      return;
    }
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    const [agg] = await PaymentTransactionModel.aggregate<{ total: number; count: number }>([
      { $match: { paymentDate: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const data: MonthlyCollectionResult = {
      year,
      month,
      totalCollected: agg?.total ?? 0,
      transactionCount: agg?.count ?? 0,
    };
    res.json({ success: true, data });
  } catch (err) {
    console.error('Monthly collection error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load monthly collection';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}

export async function getOverdueList(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const docs = await InstallmentModel.find({ status: 'overdue' })
      .populate({ path: 'planId', select: 'projectId', populate: { path: 'projectId', select: 'projectName clientId', populate: { path: 'clientId', select: 'name companyName' } } })
      .sort({ dueDate: 1 })
      .lean();
    const rows: OverdueInstallmentRow[] = docs.map((d: Record<string, unknown>) => {
      const plan = d.planId as { projectId?: { projectName?: string; clientId?: { name?: string; companyName?: string } } } | null;
      let projectName: string | undefined;
      let clientName: string | undefined;
      if (plan?.projectId && typeof plan.projectId === 'object') {
        projectName = (plan.projectId as { projectName?: string }).projectName;
        const client = (plan.projectId as { clientId?: { name?: string; companyName?: string } }).clientId;
        if (client) clientName = (client.companyName as string) || (client.name as string);
      }
      return {
        _id: (d._id as { toString: () => string }).toString(),
        planId: (d.planId as { _id?: { toString: () => string } })?._id?.toString() ?? '',
        projectName,
        clientName,
        installmentNo: d.installmentNo as number,
        dueDate: (d.dueDate as Date).toISOString(),
        dueAmount: d.dueAmount as number,
        paidAmount: (d.paidAmount as number) ?? 0,
        overdueDays: (d.overdueDays as number) ?? 0,
      };
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Overdue list error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load overdue list';
    res.status(500).json({ success: false, error: { code: 'REPORT_ERROR', message } });
  }
}
