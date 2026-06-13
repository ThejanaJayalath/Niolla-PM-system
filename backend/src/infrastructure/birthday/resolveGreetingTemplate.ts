import fs from 'fs';
import path from 'path';
import { GreetingTemplateType } from '../../domain/entities/GreetingCardTemplate';
import { GreetingCardTemplateModel } from '../database/models/GreetingCardTemplateModel';
import { getGreetingTemplatesDir } from './greetingCardTemplatePaths';

export interface ResolvedGreetingTemplate {
  fileName: string;
  mimeType: string;
  absolutePath: string;
  isCustom: boolean;
}

export async function resolveGreetingTemplate(
  templateType: GreetingTemplateType,
  festivalKey?: string
): Promise<ResolvedGreetingTemplate | null> {
  let doc = null;

  if (templateType === 'festival' && festivalKey?.trim()) {
    doc = await GreetingCardTemplateModel.findOne({
      templateType: 'festival',
      festivalKey: festivalKey.trim(),
    }).lean();
  }

  if (!doc && templateType === 'festival') {
    doc = await GreetingCardTemplateModel.findOne({
      templateType: 'festival',
      $or: [{ festivalKey: { $exists: false } }, { festivalKey: null }, { festivalKey: '' }],
    }).lean();
  }

  if (!doc && templateType !== 'festival') {
    doc = await GreetingCardTemplateModel.findOne({ templateType }).lean();
  }

  if (!doc?.storedFileName) return null;

  const absolutePath = path.join(getGreetingTemplatesDir(), doc.storedFileName);
  if (!fs.existsSync(absolutePath)) return null;

  return {
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    absolutePath,
    isCustom: true,
  };
}
