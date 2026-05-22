import { Response } from 'express';
import { CustomerService } from '../../application/services/CustomerService';
import { AuthenticatedRequest } from '../middleware/auth';

const customerService = new CustomerService();

export async function createCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      name,
      phoneNumber,
      email,
      projects,
      inquiryId,
      address,
      businessType,
      companyName,
      nicNumber,
      status,
      productId,
      serviceCategories,
      dateOfBirth,
    } = req.body;
    const customer = await customerService.create({
      name,
      phoneNumber,
      email,
      projects: Array.isArray(projects) ? projects : [],
      inquiryId,
      address,
      businessType,
      companyName,
      nicNumber,
      status,
      productId,
      serviceCategories: Array.isArray(serviceCategories) ? serviceCategories : [],
      dateOfBirth,
    });
    res.status(201).json({ success: true, data: customer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create customer';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
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
  const productId = req.query.productId as string | undefined;
  const serviceCategory = req.query.serviceCategory as string | undefined;
  const customers = await customerService.findAll({ search, productId, serviceCategory });
  res.json({ success: true, data: customers });
}

export async function updateCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const customer = await customerService.update(req.params.id, req.body);
    if (!customer) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }
    res.json({ success: true, data: customer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update customer';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function deleteCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const deleted = await customerService.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Customer not found' } });
    return;
  }
  res.status(204).send();
}
