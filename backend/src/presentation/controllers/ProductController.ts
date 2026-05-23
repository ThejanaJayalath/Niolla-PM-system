import { Response } from 'express';
import { ProductService } from '../../application/services/ProductService';
import { ProductSalesService } from '../../application/services/ProductSalesService';
import { AuthenticatedRequest } from '../middleware/auth';

const productService = new ProductService();
const productSalesService = new ProductSalesService();

export async function createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await productService.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function getProductSalesAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  const analytics = await productSalesService.getAnalytics();
  res.json({ success: true, data: analytics });
}

export async function listProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const activeOnly = req.query.activeOnly === 'true';
  if (activeOnly) {
    const products = await productService.findAllActive();
    res.json({ success: true, data: products });
    return;
  }
  const products = await productService.findAllWithStats();
  res.json({ success: true, data: products });
}

export async function getProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const product = await productService.findById(req.params.id);
  if (!product) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    return;
  }
  res.json({ success: true, data: product });
}

export async function updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const product = await productService.update(req.params.id, req.body);
    if (!product) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
      return;
    }
    res.json({ success: true, data: product });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function deleteProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await productService.delete(req.params.id);
  if (!result.deleted) {
    res.status(400).json({
      success: false,
      error: { code: 'CONFLICT', message: result.reason || 'Product could not be deleted' },
    });
    return;
  }
  res.status(204).send();
}
