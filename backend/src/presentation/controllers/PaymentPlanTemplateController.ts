import { Response } from 'express';
import { PaymentPlanTemplateModel } from '../../infrastructure/database/models/PaymentPlanTemplateModel';
import { AuthenticatedRequest } from '../middleware/auth';

export async function createTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const doc = await PaymentPlanTemplateModel.create(req.body);
        res.status(201).json({ success: true, data: doc });
    } catch (err: any) {
        res.status(400).json({ success: false, error: { message: err.message } });
    }
}

export async function getTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const docs = await PaymentPlanTemplateModel.find({}).sort({ createdAt: -1 });
        res.json({ success: true, data: docs });
    } catch (err: any) {
        res.status(500).json({ success: false, error: { message: err.message } });
    }
}

export async function updateTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const doc = await PaymentPlanTemplateModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!doc) {
            res.status(404).json({ success: false, error: { message: 'Template not found' } });
            return;
        }
        res.json({ success: true, data: doc });
    } catch (err: any) {
        res.status(400).json({ success: false, error: { message: err.message } });
    }
}

export async function deleteTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
        const doc = await PaymentPlanTemplateModel.findByIdAndDelete(req.params.id);
        if (!doc) {
            res.status(404).json({ success: false, error: { message: 'Template not found' } });
            return;
        }
        res.status(204).send();
    } catch (err: any) {
        res.status(500).json({ success: false, error: { message: err.message } });
    }
}
