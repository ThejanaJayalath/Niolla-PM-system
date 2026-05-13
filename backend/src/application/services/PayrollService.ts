import mongoose from 'mongoose';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { CompanyExpenseModel } from '../../infrastructure/database/models/CompanyExpenseModel';
import { ExpenseService } from './ExpenseService';

export interface PayrollPreviewRow {
  developerId: string;
  developerName: string;
  baseSalary: number;
  walletBalance: number;
  totalPay: number;
  alreadyPaid: boolean;
}

export interface PayrollPreviewResult {
  period: string;
  year: number;
  month: number;
  rows: PayrollPreviewRow[];
  totalPayroll: number;
}

export interface PayrollRunRow {
  developerId: string;
  developerName: string;
  baseSalary: number;
  walletPortion: number;
  totalPaid: number;
  expenseId?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface PayrollRunResult {
  period: string;
  rows: PayrollRunRow[];
  totalPaid: number;
  paidCount: number;
  skippedCount: number;
}

function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export class PayrollService {
  private expenseService = new ExpenseService();

  private parsePeriod(year?: number, month?: number): { year: number; month: number; period: string } {
    const now = new Date();
    const y = year && year >= 2000 && year <= 2100 ? year : now.getFullYear();
    const m = month && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
    return { year: y, month: m, period: periodKey(y, m) };
  }

  async preview(year?: number, month?: number): Promise<PayrollPreviewResult> {
    const { year: y, month: m, period } = this.parsePeriod(year, month);
    const employees = await UserModel.find({ role: 'employee', status: 'active' })
      .select('name baseSalary walletBalance')
      .lean();

    const paidDevIds = new Set(
      (
        await CompanyExpenseModel.find({
          automationKind: 'MONTHLY_PAYROLL',
          payrollPeriod: period,
          source: 'automated',
        })
          .select('developerId')
          .lean()
      ).map((r) => String(r.developerId))
    );

    const rows: PayrollPreviewRow[] = employees.map((emp) => {
      const baseSalary = Number(emp.baseSalary) || 0;
      const walletBalance = Number(emp.walletBalance) || 0;
      const totalPay = baseSalary + walletBalance;
      const developerId = String(emp._id);
      return {
        developerId,
        developerName: (emp.name as string) || 'Developer',
        baseSalary,
        walletBalance,
        totalPay,
        alreadyPaid: paidDevIds.has(developerId),
      };
    });

    return {
      period,
      year: y,
      month: m,
      rows,
      totalPayroll: rows.filter((r) => !r.alreadyPaid).reduce((s, r) => s + r.totalPay, 0),
    };
  }

  async runMonth(year: number | undefined, month: number | undefined, recordedByUserId: string): Promise<PayrollRunResult> {
    const uid = recordedByUserId?.trim();
    if (!uid || !mongoose.Types.ObjectId.isValid(uid)) throw new Error('Invalid recorder');

    const preview = await this.preview(year, month);
    const rows: PayrollRunRow[] = [];
    let totalPaid = 0;
    let paidCount = 0;
    let skippedCount = 0;

    for (const row of preview.rows) {
      if (row.alreadyPaid) {
        rows.push({
          developerId: row.developerId,
          developerName: row.developerName,
          baseSalary: row.baseSalary,
          walletPortion: row.walletBalance,
          totalPaid: 0,
          skipped: true,
          skipReason: 'Already paid for this period',
        });
        skippedCount += 1;
        continue;
      }

      if (row.totalPay <= 0) {
        rows.push({
          developerId: row.developerId,
          developerName: row.developerName,
          baseSalary: row.baseSalary,
          walletPortion: row.walletBalance,
          totalPaid: 0,
          skipped: true,
          skipReason: 'No base salary or wallet balance',
        });
        skippedCount += 1;
        continue;
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      let expenseId: string | null = null;
      try {
        const user = await UserModel.findById(row.developerId).session(session);
        if (!user || user.role !== 'employee') {
          await session.abortTransaction();
          rows.push({
            developerId: row.developerId,
            developerName: row.developerName,
            baseSalary: row.baseSalary,
            walletPortion: row.walletBalance,
            totalPaid: 0,
            skipped: true,
            skipReason: 'Employee not found',
          });
          skippedCount += 1;
          continue;
        }

        const walletPortion = Number(user.walletBalance) || 0;
        const baseSalary = Number(user.baseSalary) || 0;
        const total = baseSalary + walletPortion;
        if (total <= 0) {
          await session.abortTransaction();
          rows.push({
            developerId: row.developerId,
            developerName: row.developerName,
            baseSalary,
            walletPortion,
            totalPaid: 0,
            skipped: true,
            skipReason: 'Nothing to pay',
          });
          skippedCount += 1;
          continue;
        }

        user.walletBalance = 0;
        await user.save({ session });
        await session.commitTransaction();

        expenseId = await this.expenseService.logMonthlyPayrollSalary({
          developerId: row.developerId,
          developerName: row.developerName,
          baseSalary,
          walletPortion,
          totalPaid: total,
          payrollPeriod: preview.period,
          recordedByUserId: uid,
        });

        if (!expenseId) {
          await UserModel.findByIdAndUpdate(row.developerId, { $inc: { walletBalance: walletPortion } });
          rows.push({
            developerId: row.developerId,
            developerName: row.developerName,
            baseSalary,
            walletPortion,
            totalPaid: 0,
            skipped: true,
            skipReason: 'Could not log salary expense',
          });
          skippedCount += 1;
          continue;
        }

        rows.push({
          developerId: row.developerId,
          developerName: row.developerName,
          baseSalary,
          walletPortion,
          totalPaid: total,
          expenseId,
        });
        totalPaid += total;
        paidCount += 1;
      } catch {
        await session.abortTransaction();
        rows.push({
          developerId: row.developerId,
          developerName: row.developerName,
          baseSalary: row.baseSalary,
          walletPortion: row.walletBalance,
          totalPaid: 0,
          skipped: true,
          skipReason: 'Payroll transaction failed',
        });
        skippedCount += 1;
      } finally {
        session.endSession();
      }
    }

    return {
      period: preview.period,
      rows,
      totalPaid,
      paidCount,
      skippedCount,
    };
  }
}
