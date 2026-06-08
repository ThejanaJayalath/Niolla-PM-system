import { Response } from 'express';
import { Project } from '../../domain/entities/Project';
import { ProjectService } from '../../application/services/ProjectService';
import { CustomerRequirementService } from '../../application/services/CustomerRequirementService';
import { PaymentPlanService } from '../../application/services/PaymentPlanService';
import { ExpenseService } from '../../application/services/ExpenseService';
import { UserModel } from '../../infrastructure/database/models/UserModel';
import { AuthenticatedRequest } from '../middleware/auth';

const projectService = new ProjectService();
const customerRequirementService = new CustomerRequirementService();
const paymentPlanService = new PaymentPlanService();
const expenseService = new ExpenseService();

function projectForClientRole(project: Project, role: string | undefined): Project {
  if (role === 'employee') {
    const {
      totalDeveloperPayouts: _tdp,
      netProfit: _np,
      expenses: _ex,
      totalValue: _tv,
      assignedEmployeePayouts: _aep,
      ...rest
    } = project;
    return rest as Project;
  }
  return project;
}

export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { clientId, projectName, description, systemType, totalValue, expenses, startDate, endDate, status } = req.body;
  const project = await projectService.create({
    clientId,
    projectName,
    description,
    systemType,
    totalValue,
    expenses,
    startDate,
    endDate,
    status,
  });
  const expensesNum = Math.max(0, Number(expenses) || 0);
  if (expensesNum > 0 && project._id && req.user?.userId) {
    try {
      await expenseService.logAutomatedInfrastructureFromProjectExpense({
        projectId: String(project._id),
        projectName: project.projectName,
        deltaAmount: expensesNum,
        recordedByUserId: req.user.userId,
      });
    } catch {
      /* non-fatal */
    }
  }
  res.status(201).json({ success: true, data: project });
}

/** Project + linked requirements + employee directory (admin full; assigned developer read-only for their tasks). */
export async function getRequirementWorkflow(req: AuthenticatedRequest, res: Response): Promise<void> {
  const project = await projectService.findById(req.params.id);
  if (!project) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }
  const requirements = await customerRequirementService.findByProjectRef(req.params.id);
  if (req.user?.role === 'employee' && req.user.userId) {
    const assignees = (project.assignedEmployees ?? []).map(String);
    const onRequirement = requirements.some((r) =>
      (r.assignedEmployeeIds || []).map(String).includes(req.user!.userId!)
    );
    if (!assignees.includes(req.user.userId) && !onRequirement) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not allowed' } });
      return;
    }
  }
  const employees = await UserModel.find({ role: 'employee' }).select('name email').sort({ name: 1 }).lean();
  const employeeOptions = employees.map((e) => ({
    _id: e._id.toString(),
    name: (e.name as string) || 'Developer',
    email: (e.email as string) || undefined,
  }));
  res.json({ success: true, data: { project, requirements, employees: employeeOptions } });
}

export async function patchRequirementWorkflowAssignments(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user?.role === 'employee') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not allowed' } });
    return;
  }
  const projectId = req.params.id;
  const project = await projectService.findById(projectId);
  if (!project) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }
  const assignments = req.body.assignments as Record<string, string[]> | undefined;
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'assignments must be an object of requirementId → employeeId[]' },
    });
    return;
  }
  const payoutValues = req.body.requirementPayoutValues as Record<string, number | null | undefined> | undefined;
  const requirements = await customerRequirementService.setRequirementAssigneesForProject(
    projectId,
    assignments,
    payoutValues
  );
  const updatedProject = await projectService.findById(projectId);
  res.json({ success: true, data: { project: updatedProject, requirements } });
}

export async function postAddonPaymentPlanForRequirement(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'owner' && req.user?.role !== 'pm') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not allowed' } });
    return;
  }
  const projectId = req.params.id;
  const { requirementId } = req.params;
  const reqDoc = await customerRequirementService.findById(requirementId);
  if (!reqDoc || reqDoc.projectRef !== projectId) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Requirement not found for this project' },
    });
    return;
  }
  const totalValue = Number(req.body.totalValue);
  const downPaymentPct = Number(req.body.downPaymentPct);
  const totalInstallments = Number(req.body.totalInstallments);
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'totalValue must be a positive number' } });
    return;
  }
  if (!Number.isFinite(downPaymentPct) || downPaymentPct < 0 || downPaymentPct > 100) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'downPaymentPct must be 0–100' } });
    return;
  }
  if (!Number.isFinite(totalInstallments) || totalInstallments < 1) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'totalInstallments must be at least 1' } });
    return;
  }
  const plan = await paymentPlanService.createAddonPlanForRequirement({
    projectId,
    requirementId,
    totalValue,
    downPaymentPct,
    totalInstallments,
    serviceFeePct: req.body.serviceFeePct,
    planStartDate: req.body.planStartDate,
  });
  res.status(201).json({ success: true, data: plan });
}

export async function getProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const project = await projectService.findById(req.params.id);
  if (!project) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }
  if (req.user?.role === 'employee' && req.user.userId) {
    const assignees = (project.assignedEmployees ?? []).map(String);
    if (!assignees.includes(req.user.userId)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not assigned to this project' },
      });
      return;
    }
  }
  res.json({ success: true, data: projectForClientRole(project, req.user?.role) });
}

export async function listProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clientId = req.query.clientId as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const assignedUserId =
    req.user?.role === 'employee' && req.user.userId ? req.user.userId : undefined;
  const projects = await projectService.findAll({ clientId, status, search, assignedUserId });
  const role = req.user?.role;
  res.json({
    success: true,
    data: role === 'employee' ? projects.map((p) => projectForClientRole(p, role)) : projects,
  });
}

export async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const before = await projectService.findById(req.params.id);
    const project = await projectService.update(req.params.id, req.body);
    if (!project) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    if (req.body.expenses !== undefined && before && req.user?.userId) {
      const oldExp = Math.max(0, Number(before.expenses) || 0);
      const newExp = Math.max(0, Number(project.expenses) || 0);
      const delta = newExp - oldExp;
      if (delta > 0) {
        try {
          await expenseService.logAutomatedInfrastructureFromProjectExpense({
            projectId: String(project._id),
            projectName: project.projectName,
            deltaAmount: delta,
            recordedByUserId: req.user.userId,
          });
        } catch {
          /* non-fatal */
        }
      }
    }
    res.json({ success: true, data: projectForClientRole(project, req.user?.role) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update project';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await projectService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }
  res.status(204).send();
}

/** Logged-in user: agreed task payouts on active projects (developer “pending earnings”). */
export async function getMyPendingDeveloperEarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  const data = await projectService.getPendingDeveloperEarnings(userId);
  res.json({ success: true, data });
}

/** Wallet ledger + balance (MongoDB `developerwalletledgers`, model name `Wallet`). */
export async function getDeveloperWallet(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  const data = await projectService.getPendingDeveloperEarnings(userId);
  res.json({ success: true, data: data.wallet });
}

/** Staff assignments for the developer (`Staff_Assignments` collection). */
export async function getDeveloperStaffAssignments(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  const data = await projectService.getPendingDeveloperEarnings(userId);
  res.json({ success: true, data: data.staffAssignments });
}

/** Developer portal: project requirements assigned to the logged-in employee. */
export async function listMyRequirementTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  if (req.user?.role !== 'employee') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'For developers only' } });
    return;
  }
  const data = await customerRequirementService.findAssignedRequirementsForEmployee(userId);
  res.json({ success: true, data });
}

export async function listPendingPayoutApprovals(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'owner' && req.user?.role !== 'pm') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can view payout approvals' } });
    return;
  }
  const data = await projectService.listPendingPayoutApprovals();
  res.json({ success: true, data });
}

export async function submitDeveloperPayoutCompletion(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'employee') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only developers can mark work complete' } });
    return;
  }
  const userId = req.user.userId;
  try {
    const project = await projectService.submitDeveloperPayoutCompletion(req.params.id, userId);
    if (!project) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Cannot submit completion (check assignment, payout, and project status).' },
      });
      return;
    }
    res.json({ success: true, data: projectForClientRole(project, req.user?.role) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Submit failed';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}

export async function approveDeveloperPayoutRelease(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user?.role !== 'owner' && req.user?.role !== 'pm') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admin can approve payout release' } });
    return;
  }
  const developerId = req.body?.developerId as string | undefined;
  if (!developerId?.trim()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'developerId is required' } });
    return;
  }
  try {
    const project = await projectService.approveDeveloperPayoutRelease(
      req.params.id,
      developerId.trim(),
      req.user.userId
    );
    if (!project) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Cannot approve (developer may not be awaiting approval).' },
      });
      return;
    }
    res.json({ success: true, data: projectForClientRole(project, req.user?.role) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Approval failed';
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message } });
  }
}
