import { Response } from 'express';
import { CustomerService } from '../../application/services/CustomerService';
import { AuthenticatedRequest } from '../middleware/auth';

const customerService = new CustomerService();

export async function createCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, phoneNumber, email, projects, inquiryId } = req.body;
  const customer = await customerService.create({
    name,
    phoneNumber,
    email,
    projects: Array.isArray(projects) ? projects : [],
    inquiryId,
  });
  res.status(201).json({ success: true, data: customer });
}

export async function getCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customer = await customerService.findById(req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }
  res.json({ success: true, data: customer });
}

export async function listCustomers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const search = req.query.search as string | undefined;
  const customers = await customerService.findAll({ search });
  res.json({ success: true, data: customers });
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customer = await customerService.update(req.params.id, req.body);
  if (!customer) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }
  res.json({ success: true, data: customer });
}

export async function deleteCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await customerService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }
  res.status(204).send();
}
