import type { ProjectLifecycleStatus } from '../projectLifecycle';

export interface Project {
  _id?: string;
  clientId: string;
  /** Catalog product sold to this client (denormalized from customer when created). */
  productId?: string;
  projectName: string;
  description?: string;
  systemType?: string;
  totalValue: number;
  /** Other deal costs (materials, tools, external fees, etc.). */
  expenses?: number;
  /** Sum of all `assignedEmployeePayouts` values (computed for API responses). */
  totalDeveloperPayouts?: number;
  /** totalValue − (totalDeveloperPayouts + expenses). Computed for admin visibility. */
  netProfit?: number;
  startDate?: Date;
  endDate?: Date;
  assignedEmployees?: string[];
  assignedEmployeePayouts?: Record<string, number>;
  /** Per assignee: accruing → submitted (dev marked complete) → released (admin approved → wallet). */
  assignedEmployeePayoutRelease?: Record<string, 'accruing' | 'submitted' | 'released'>;
  status: ProjectLifecycleStatus;
  /** Customer-portal requirements driving admin workflow (list/detail API only). */
  requirementWorkflowLabel?: 'none' | 'to_be_updated' | 'updated';
  /** Planned value of add-on payment plans for this project (computed). */
  addonPaymentPlansTotal?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
