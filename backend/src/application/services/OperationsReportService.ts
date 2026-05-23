import mongoose from 'mongoose';
import { ProjectModel } from '../../infrastructure/database/models/ProjectModel';
import { ProjectTaskModel } from '../../infrastructure/database/models/ProjectTaskModel';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { DeveloperWalletLedgerModel } from '../../infrastructure/database/models/DeveloperWalletLedgerModel';
import { StaffAssignmentModel } from '../../infrastructure/database/models/StaffAssignmentModel';
import { ExpenseService, type MarketingRoiReport } from './ExpenseService';
import type { ReportPeriodParams } from './FinancialReportService';

function parseReportRange(from?: string, to?: string): { start?: Date; end?: Date } {
  let start: Date | undefined;
  let end: Date | undefined;
  if (from?.trim()) {
    start = new Date(from.trim());
    if (Number.isNaN(start.getTime())) start = undefined;
    else start.setHours(0, 0, 0, 0);
  }
  if (to?.trim()) {
    end = new Date(to.trim());
    if (Number.isNaN(end.getTime())) end = undefined;
    else end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

const ACTIVE_STATUSES = ['under_development', 'unassigned'] as const;

export interface ProjectProgressRow {
  projectId: string;
  projectName: string;
  clientName?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  daysRemaining: number | null;
  isOverdue: boolean;
  totalValue: number;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  assignedDevelopers: number;
}

export interface ProjectProgressReport {
  generatedAt: string;
  activeProjectCount: number;
  sourceTable: 'Projects';
  projects: ProjectProgressRow[];
}

export interface StaffPerformanceRow {
  developerId: string;
  developerName: string;
  email: string;
  walletBalance: number;
  baseSalary: number;
  totalEarned: number;
  earnedThisMonth: number;
  pendingPayout: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  completionRate: number;
}

export interface StaffPerformanceReport {
  generatedAt: string;
  developerCount: number;
  sourceTable: 'Staff_Wallet';
  staff: StaffPerformanceRow[];
}

export interface StaffWalletEntry {
  entryId: string;
  developerId: string;
  developerName: string;
  projectId: string;
  projectName: string;
  amount: number;
  walletStatus: string;
  submittedAt: string;
  approvedAt?: string;
}

export interface StaffWalletReport {
  period: string;
  sourceTable: 'Staff_Wallet';
  totalEntries: number;
  totalAmount: number;
  entries: StaffWalletEntry[];
}

function escapeCsv(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCsv).join(',');
}

function formatReportDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntilEnd(endDate?: Date | null): { daysRemaining: number | null; isOverdue: boolean } {
  if (!endDate) return { daysRemaining: null, isOverdue: false };
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  const diff = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return { daysRemaining: diff, isOverdue: diff < 0 };
}

export class OperationsReportService {
  private expenseService = new ExpenseService();

  async getProjectProgressReport(): Promise<ProjectProgressReport> {
    const projects = await ProjectModel.find({ status: { $in: ACTIVE_STATUSES } })
      .populate('clientId', 'name companyName')
      .sort({ endDate: 1, projectName: 1 })
      .lean();

    const projectIds = projects.map((p) => p._id as mongoose.Types.ObjectId);
    const taskAgg = await ProjectTaskModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      total: number;
      completed: number;
    }>([
      { $match: { projectId: { $in: projectIds } } },
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
        },
      },
    ]);

    const taskByProject = new Map(
      taskAgg.map((row) => [row._id.toString(), { total: row.total, completed: row.completed }])
    );

    const rows: ProjectProgressRow[] = projects.map((p) => {
      const pid = (p._id as mongoose.Types.ObjectId).toString();
      const stats = taskByProject.get(pid) ?? { total: 0, completed: 0 };
      const completionPercent =
        stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      const client = p.clientId as { name?: string; companyName?: string } | null;
      const clientName = client?.companyName || client?.name;
      const { daysRemaining, isOverdue } = daysUntilEnd(p.endDate);

      return {
        projectId: pid,
        projectName: p.projectName,
        clientName,
        status: p.status,
        startDate: p.startDate ? new Date(p.startDate).toISOString() : undefined,
        endDate: p.endDate ? new Date(p.endDate).toISOString() : undefined,
        daysRemaining,
        isOverdue,
        totalValue: Number(p.totalValue) || 0,
        totalTasks: stats.total,
        completedTasks: stats.completed,
        completionPercent,
        assignedDevelopers: (p.assignedEmployees || []).length,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      activeProjectCount: rows.length,
      sourceTable: 'Projects' as const,
      projects: rows,
    };
  }

  async getStaffPerformanceReport(): Promise<StaffPerformanceReport> {
    const developers = await UserModel.find({ role: 'employee', status: 'active' })
      .select('name email walletBalance baseSalary')
      .sort({ name: 1 })
      .lean();

    const devIds = developers.map((d) => d._id as mongoose.Types.ObjectId);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [taskAgg, earnedAgg, monthEarnedAgg, pendingAgg, activeProjectAgg] = await Promise.all([
      ProjectTaskModel.aggregate<{
        _id: mongoose.Types.ObjectId;
        total: number;
        completed: number;
      }>([
        { $match: { assigneeIds: { $in: devIds } } },
        { $unwind: '$assigneeIds' },
        { $match: { assigneeIds: { $in: devIds } } },
        {
          $group: {
            _id: '$assigneeIds',
            total: { $sum: 1 },
            completed: { $sum: { $cond: ['$completed', 1, 0] } },
          },
        },
      ]),
      DeveloperWalletLedgerModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
        {
          $match: {
            developerId: { $in: devIds },
            $or: [{ walletStatus: 'Available' }, { status: 'approved' }],
          },
        },
        { $group: { _id: '$developerId', total: { $sum: '$amount' } } },
      ]),
      DeveloperWalletLedgerModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
        {
          $match: {
            developerId: { $in: devIds },
            approvedAt: { $gte: startMonth },
            $or: [{ walletStatus: 'Available' }, { status: 'approved' }],
          },
        },
        { $group: { _id: '$developerId', total: { $sum: '$amount' } } },
      ]),
      StaffAssignmentModel.aggregate<{ _id: mongoose.Types.ObjectId; total: number }>([
        {
          $match: {
            userId: { $in: devIds },
            workflowStatus: { $ne: 'CreditedToWallet' },
          },
        },
        { $group: { _id: '$userId', total: { $sum: '$agreedPayout' } } },
      ]),
      ProjectModel.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { status: 'under_development', assignedEmployees: { $in: devIds } } },
        { $unwind: '$assignedEmployees' },
        { $match: { assignedEmployees: { $in: devIds } } },
        { $group: { _id: '$assignedEmployees', count: { $sum: 1 } } },
      ]),
    ]);

    const taskMap = new Map(taskAgg.map((r) => [r._id.toString(), r]));
    const earnedMap = new Map(earnedAgg.map((r) => [r._id.toString(), r.total]));
    const monthMap = new Map(monthEarnedAgg.map((r) => [r._id.toString(), r.total]));
    const pendingMap = new Map(pendingAgg.map((r) => [r._id.toString(), r.total]));
    const activeMap = new Map(activeProjectAgg.map((r) => [r._id.toString(), r.count]));

    const staff: StaffPerformanceRow[] = developers.map((d) => {
      const id = (d._id as mongoose.Types.ObjectId).toString();
      const tasks = taskMap.get(id);
      const totalTasks = tasks?.total ?? 0;
      const completedTasks = tasks?.completed ?? 0;
      const openTasks = totalTasks - completedTasks;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      return {
        developerId: id,
        developerName: d.name,
        email: d.email,
        walletBalance: Number(d.walletBalance) || 0,
        baseSalary: Number(d.baseSalary) || 0,
        totalEarned: earnedMap.get(id) ?? 0,
        earnedThisMonth: monthMap.get(id) ?? 0,
        pendingPayout: pendingMap.get(id) ?? 0,
        activeProjects: activeMap.get(id) ?? 0,
        totalTasks,
        completedTasks,
        openTasks,
        completionRate,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      developerCount: staff.length,
      sourceTable: 'Staff_Wallet',
      staff,
    };
  }

  /** Staff_Wallet table (developerwalletledgers collection). */
  async getStaffWalletReport(period?: ReportPeriodParams): Promise<StaffWalletReport> {
    const { start, end } = parseReportRange(period?.from, period?.to);
    const query: Record<string, unknown> = {};
    if (start || end) {
      const range: Record<string, Date> = {};
      if (start) range.$gte = start;
      if (end) range.$lte = end;
      query.submittedAt = range;
    }

    const docs = await DeveloperWalletLedgerModel.find(query)
      .sort({ submittedAt: -1 })
      .populate('developerId', 'name')
      .lean();

    const entries: StaffWalletEntry[] = docs.map((doc) => {
      const dev = doc.developerId as { _id?: unknown; name?: string } | null;
      return {
        entryId: String(doc._id),
        developerId: dev && typeof dev === 'object' && dev._id ? String(dev._id) : String(doc.developerId),
        developerName: dev?.name || 'Developer',
        projectId: String(doc.projectId),
        projectName: doc.projectName,
        amount: Number(doc.amount) || 0,
        walletStatus: doc.walletStatus || 'Pending',
        submittedAt: new Date(doc.submittedAt).toISOString(),
        approvedAt: doc.approvedAt ? new Date(doc.approvedAt).toISOString() : undefined,
      };
    });

    const periodLabel =
      start && end
        ? `${formatReportDate(start.toISOString())} – ${formatReportDate(end.toISOString())}`
        : 'all-time';

    return {
      period: periodLabel,
      sourceTable: 'Staff_Wallet',
      totalEntries: entries.length,
      totalAmount: entries.reduce((s, e) => s + e.amount, 0),
      entries,
    };
  }

  async buildStaffWalletCsv(period?: ReportPeriodParams): Promise<{ filename: string; csv: string }> {
    const report = await this.getStaffWalletReport(period);
    const lines: string[] = [];
    lines.push('Niolla Nexa — Staff Wallet Report');
    lines.push(`Period,${escapeCsv(report.period)}`);
    lines.push(`Source table,${report.sourceTable}`);
    lines.push(`Total entries,${report.totalEntries}`);
    lines.push(`Total amount,${report.totalAmount}`);
    lines.push('');
    lines.push(
      csvLine(['Developer', 'Project', 'Amount (LKR)', 'Status', 'Submitted', 'Approved'])
    );
    for (const row of report.entries) {
      lines.push(
        csvLine([
          row.developerName,
          row.projectName,
          row.amount,
          row.walletStatus,
          formatReportDate(row.submittedAt),
          row.approvedAt ? formatReportDate(row.approvedAt) : '',
        ])
      );
    }
    return { filename: `staff-wallet-report-${report.period}.csv`, csv: lines.join('\r\n') };
  }

  async getMarketingRoiReport(filters?: { from?: string; to?: string }): Promise<MarketingRoiReport> {
    return this.expenseService.getMarketingRoi(filters);
  }

  async buildProjectProgressCsv(): Promise<{ filename: string; csv: string }> {
    const report = await this.getProjectProgressReport();
    const lines: string[] = [];
    lines.push('Niolla Nexa — Project Progress Report');
    lines.push(`Source table,Projects`);
    lines.push(`Generated,${escapeCsv(report.generatedAt)}`);
    lines.push(`Active projects,${report.activeProjectCount}`);
    lines.push('');
    lines.push(
      csvLine([
        'Project',
        'Client',
        'Status',
        'Start',
        'End',
        'Days remaining',
        'Overdue',
        'Tasks done',
        'Tasks total',
        'Completion %',
        'Contract value (LKR)',
        'Developers',
      ])
    );
    for (const row of report.projects) {
      lines.push(
        csvLine([
          row.projectName,
          row.clientName || '',
          row.status,
          formatReportDate(row.startDate),
          formatReportDate(row.endDate),
          row.daysRemaining ?? '',
          row.isOverdue ? 'Yes' : 'No',
          row.completedTasks,
          row.totalTasks,
          row.completionPercent,
          row.totalValue,
          row.assignedDevelopers,
        ])
      );
    }
    return { filename: 'project-progress-report.csv', csv: lines.join('\r\n') };
  }

  async buildStaffPerformanceCsv(): Promise<{ filename: string; csv: string }> {
    const report = await this.getStaffPerformanceReport();
    const lines: string[] = [];
    lines.push('Niolla Nexa — Staff Performance & Wallet Report');
    lines.push(`Generated,${escapeCsv(report.generatedAt)}`);
    lines.push('');
    lines.push(
      csvLine([
        'Developer',
        'Email',
        'Wallet (LKR)',
        'Base salary (LKR)',
        'Total earned (LKR)',
        'Earned this month (LKR)',
        'Pending payout (LKR)',
        'Active projects',
        'Tasks completed',
        'Tasks open',
        'Completion %',
      ])
    );
    for (const row of report.staff) {
      lines.push(
        csvLine([
          row.developerName,
          row.email,
          row.walletBalance,
          row.baseSalary,
          row.totalEarned,
          row.earnedThisMonth,
          row.pendingPayout,
          row.activeProjects,
          row.completedTasks,
          row.openTasks,
          row.completionRate,
        ])
      );
    }
    return { filename: 'staff-performance-report.csv', csv: lines.join('\r\n') };
  }

  async buildMarketingRoiCsv(filters?: { from?: string; to?: string }): Promise<{ filename: string; csv: string }> {
    const report = await this.getMarketingRoiReport(filters);
    const lines: string[] = [];
    lines.push('Niolla Nexa — Marketing Spend vs Revenue');
    if (report.from) lines.push(`From,${escapeCsv(report.from)}`);
    if (report.to) lines.push(`To,${escapeCsv(report.to)}`);
    lines.push(`Total marketing spend,${report.totalMarketingSpend}`);
    lines.push(`Attributed spend,${report.attributedSpend}`);
    lines.push(`Attributed project value,${report.attributedProjectValue}`);
    lines.push(`Overall ROI %,${report.overallRoiPercent ?? ''}`);
    lines.push('');
    lines.push(
      csvLine(['Date', 'Description', 'Spend (LKR)', 'Project', 'Project value (LKR)', 'ROI %', 'Return multiple'])
    );
    for (const row of report.rows) {
      lines.push(
        csvLine([
          formatReportDate(row.expenseDate),
          row.description,
          row.marketingSpend,
          row.projectName || '',
          row.projectValue,
          row.roiPercent ?? '',
          row.returnMultiple ?? '',
        ])
      );
    }
    return { filename: 'marketing-roi-report.csv', csv: lines.join('\r\n') };
  }
}
