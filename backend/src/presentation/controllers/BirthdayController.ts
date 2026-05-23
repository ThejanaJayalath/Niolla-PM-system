import { Response } from 'express';
import { BirthdayService } from '../../application/services/BirthdayService';
import { BirthdaySubjectType } from '../../domain/entities/BirthdayCard';
import { streamCardImage } from '../../infrastructure/whatsapp/cardMediaUtil';
import { AuthenticatedRequest } from '../middleware/auth';

const birthdayService = new BirthdayService();

function parseSubjectType(raw: string): BirthdaySubjectType | null {
  if (raw === 'customer' || raw === 'employee' || raw === 'inquiry') return raw;
  return null;
}

export async function listTodayBirthdays(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await birthdayService.findTodayBirthdays();
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load birthdays';
    res.status(500).json({ success: false, error: { code: 'BIRTHDAY_ERROR', message } });
  }
}

export async function generateBirthdayCard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const subjectType = parseSubjectType(req.params.subjectType);
  const { subjectId } = req.params;
  if (!subjectType) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid subject type' } });
    return;
  }
  try {
    const data = await birthdayService.generateCard(subjectType, subjectId, req.body?.greetingMessage);
    res.status(201).json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate card';
    res.status(400).json({ success: false, error: { code: 'BIRTHDAY_ERROR', message } });
  }
}

export async function sendBirthdayCard(req: AuthenticatedRequest, res: Response): Promise<void> {
  const subjectType = parseSubjectType(req.params.subjectType);
  const { subjectId } = req.params;
  const channel = req.body?.channel;
  if (!subjectType) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid subject type' } });
    return;
  }
  if (channel !== 'email' && channel !== 'whatsapp') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'channel must be email or whatsapp' },
    });
    return;
  }
  try {
    const data = await birthdayService.sendCard(subjectType, subjectId, channel, {
      cardId: req.body?.cardId,
      greetingMessage: req.body?.greetingMessage,
    });
    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send card';
    res.status(400).json({ success: false, error: { code: 'BIRTHDAY_ERROR', message } });
  }
}

export async function getBirthdayCardImage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const file = await birthdayService.getCardFile(req.params.cardId);
    if (!file) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Card not found' } });
      return;
    }
    const format = typeof req.query.format === 'string' ? req.query.format : undefined;
    const { stream, mimeType } = await streamCardImage(file.absolutePath, file.mimeType, format);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    stream.pipe(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load card image';
    res.status(500).json({ success: false, error: { code: 'BIRTHDAY_ERROR', message } });
  }
}
