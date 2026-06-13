import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  GreetingCardTemplate,
  GreetingTemplateType,
} from '../../domain/entities/GreetingCardTemplate';
import { GreetingCardTemplateModel } from '../../infrastructure/database/models/GreetingCardTemplateModel';
import { getGreetingTemplatesDir } from '../../infrastructure/birthday/greetingCardTemplatePaths';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

function mimeFromExt(ext: string): string {
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

export class GreetingCardTemplateService {
  async list(): Promise<GreetingCardTemplate[]> {
    const docs = await GreetingCardTemplateModel.find().sort({ templateType: 1, festivalKey: 1 }).lean();
    return docs.map((d) => this.toEntity(d as unknown as Record<string, unknown>));
  }

  async getInfo(
    templateType: GreetingTemplateType,
    festivalKey?: string
  ): Promise<GreetingCardTemplate | null> {
    const query: Record<string, unknown> = { templateType };
    if (templateType === 'festival' && festivalKey?.trim()) {
      query.festivalKey = festivalKey.trim();
    } else if (templateType !== 'festival') {
      /* birthday / anniversary — single doc per type */
    } else {
      query.$or = [{ festivalKey: { $exists: false } }, { festivalKey: null }, { festivalKey: '' }];
    }

    const doc = await GreetingCardTemplateModel.findOne(query).lean();
    return doc ? this.toEntity(doc as unknown as Record<string, unknown>) : null;
  }

  async upload(
    templateType: GreetingTemplateType,
    file: { originalname: string; buffer: Buffer; mimetype: string },
    uploadedBy?: string,
    festivalKey?: string
  ): Promise<GreetingCardTemplate> {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      throw new Error('Allowed formats: PNG, JPG, WEBP, or SVG');
    }
    const mimeType = ALLOWED_MIME.has(file.mimetype) ? file.mimetype : mimeFromExt(ext);
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new Error('Invalid image type');
    }

    const storedFileName = `${templateType}-${festivalKey?.trim() || 'default'}-${Date.now()}${ext}`;
    const dir = getGreetingTemplatesDir();
    fs.writeFileSync(path.join(dir, storedFileName), file.buffer);

    const filter: Record<string, unknown> = { templateType };
    const setFestivalKey =
      templateType === 'festival' && festivalKey?.trim() ? festivalKey.trim() : undefined;

    if (templateType === 'festival') {
      if (setFestivalKey) filter.festivalKey = setFestivalKey;
      else filter.$or = [{ festivalKey: { $exists: false } }, { festivalKey: null }, { festivalKey: '' }];
    }

    const existing = await GreetingCardTemplateModel.findOne(filter);
    if (existing?.storedFileName) {
      const oldPath = path.join(dir, existing.storedFileName);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          /* ignore */
        }
      }
      existing.fileName = file.originalname || `template${ext}`;
      existing.mimeType = mimeType;
      existing.storedFileName = storedFileName;
      existing.uploadedAt = new Date();
      if (uploadedBy && mongoose.Types.ObjectId.isValid(uploadedBy)) {
        existing.uploadedBy = new mongoose.Types.ObjectId(uploadedBy);
      }
      if (setFestivalKey) existing.festivalKey = setFestivalKey;
      await existing.save();
      return this.toEntity(existing.toObject() as unknown as Record<string, unknown>);
    }

    const doc = await GreetingCardTemplateModel.create({
      templateType,
      festivalKey: setFestivalKey,
      fileName: file.originalname || `template${ext}`,
      mimeType,
      storedFileName,
      uploadedBy:
        uploadedBy && mongoose.Types.ObjectId.isValid(uploadedBy)
          ? new mongoose.Types.ObjectId(uploadedBy)
          : undefined,
    });
    return this.toEntity(doc.toObject() as unknown as Record<string, unknown>);
  }

  async remove(templateType: GreetingTemplateType, festivalKey?: string): Promise<boolean> {
    const filter: Record<string, unknown> = { templateType };
    if (templateType === 'festival' && festivalKey?.trim()) {
      filter.festivalKey = festivalKey.trim();
    } else if (templateType === 'festival') {
      filter.$or = [{ festivalKey: { $exists: false } }, { festivalKey: null }, { festivalKey: '' }];
    }

    const doc = await GreetingCardTemplateModel.findOne(filter);
    if (!doc) return false;

    const filePath = path.join(getGreetingTemplatesDir(), doc.storedFileName);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        /* ignore */
      }
    }
    await GreetingCardTemplateModel.deleteOne({ _id: doc._id });
    return true;
  }

  async resolvePreviewFile(
    templateType: GreetingTemplateType,
    festivalKey?: string
  ): Promise<{ absolutePath: string; mimeType: string } | null> {
    const info = await this.getInfo(templateType, festivalKey);
    if (!info) return null;
    const absolutePath = path.join(getGreetingTemplatesDir(), info.storedFileName);
    if (!fs.existsSync(absolutePath)) return null;
    return { absolutePath, mimeType: info.mimeType };
  }

  private toEntity(o: Record<string, unknown>): GreetingCardTemplate {
    return {
      _id: (o._id as { toString: () => string })?.toString?.(),
      templateType: o.templateType as GreetingTemplateType,
      festivalKey: (o.festivalKey as string) || undefined,
      fileName: o.fileName as string,
      mimeType: o.mimeType as string,
      storedFileName: o.storedFileName as string,
      uploadedAt: o.uploadedAt as Date,
      uploadedBy: o.uploadedBy
        ? (o.uploadedBy as { toString: () => string }).toString()
        : undefined,
    };
  }
}
