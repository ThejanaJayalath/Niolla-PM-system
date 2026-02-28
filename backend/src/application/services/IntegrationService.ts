import { IntegrationModel, GOOGLE_CALENDAR_KEY } from '../../infrastructure/database/models/IntegrationModel';

export async function getGoogleRefreshToken(): Promise<string | null> {
  const doc = await IntegrationModel.findOne({ key: GOOGLE_CALENDAR_KEY }).lean();
  return doc?.refreshToken ?? null;
}

export async function setGoogleRefreshToken(refreshToken: string): Promise<void> {
  await IntegrationModel.findOneAndUpdate(
    { key: GOOGLE_CALENDAR_KEY },
    { refreshToken, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}
