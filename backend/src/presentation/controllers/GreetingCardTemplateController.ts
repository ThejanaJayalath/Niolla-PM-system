import fs from 'fs';
import { Response } from 'express';
import { GreetingCardTemplateService } from '../../application/services/GreetingCardTemplateService';
import { GreetingTemplateType } from '../../domain/entities/GreetingCardTemplate';
import { AuthenticatedRequest } from '../middleware/auth';

const service = new GreetingCardTemplateService();

function parseTemplateType(raw: string): GreetingTemplateType | null {
  if (raw === 'birthday' || raw === 'anniversary' || raw === 'festival') return raw;
  return null;
}

export async function listGreetingTemplates(_req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = await service.list();
  res.json({ success: true, data });
}

export async function getGreetingTemplateInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
  const templateType = parseTemplateType(req.params.templateType);
  if (!templateType) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid template type' } });
    return;
  }
  const festivalKey = typeof req.query.festivalKey === 'string' ? req.query.festivalKey : undefined;
  const data = await service.getInfo(templateType, festivalKey);
  res.json({
    success: true,
    data: data
      ? { hasTemplate: true, ...data, isDefault: false }
      : { hasTemplate: false, isDefault: true, templateType, festivalKey },
  });
}

export async function uploadGreetingTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  const templateType = parseTemplateType(req.params.templateType);
  if (!templateType) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid template type' } });
    return;
  }
  const file = req.file;
  if (!file?.buffer) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'No file uploaded. Use PNG, JPG, WEBP, or SVG.' },
    });
    return;
  }
  const festivalKey = typeof req.body?.festivalKey === 'string' ? req.body.festivalKey : undefined;
  try {
    const data = await service.upload(
      templateType,
      { originalname: file.originalname, buffer: file.buffer, mimetype: file.mimetype },
      req.user?.userId,
      festivalKey
    );
    res.status(201).json({
      success: true,
      data: { ...data, message: 'Card template uploaded. It will be used for the next generated cards.' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message } });
  }
}

export async function deleteGreetingTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  const templateType = parseTemplateType(req.params.templateType);
  if (!templateType) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid template type' } });
    return;
  }
  const festivalKey = typeof req.query.festivalKey === 'string' ? req.query.festivalKey : undefined;
  const ok = await service.remove(templateType, festivalKey);
  if (!ok) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No custom template to remove' } });
    return;
  }
  res.json({ success: true, data: { deleted: true } });
}

export async function previewGreetingTemplate(req: AuthenticatedRequest, res: Response): Promise<void> {
  const templateType = parseTemplateType(req.params.templateType);
  if (!templateType) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid template type' } });
    return;
  }
  const festivalKey = typeof req.query.festivalKey === 'string' ? req.query.festivalKey : undefined;
  const file = await service.resolvePreviewFile(templateType, festivalKey);
  if (!file) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No custom template uploaded' } });
    return;
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  fs.createReadStream(file.absolutePath).pipe(res);
}
