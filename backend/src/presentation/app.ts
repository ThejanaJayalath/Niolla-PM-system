import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import inquiryRoutes from './routes/inquiryRoutes';
import reminderRoutes from './routes/reminderRoutes';
import integrationRoutes from './routes/integrationRoutes';
import proposalRoutes from './routes/proposalRoutes';
import billingRoutes from './routes/billingRoutes';
import { getOAuthStartRouter, handleOAuthCallback } from './routes/googleOAuthRoutes';
import { errorHandler } from './middleware/errorHandler';
import { connectDatabase } from '../infrastructure/database/mongo';

export const app = express();

// Lazy DB connect for Vercel serverless (no listen/bootstrap)
let dbPromise: Promise<void> | null = null;
app.use((_req: Request, _res: Response, next: NextFunction) => {
  if (!dbPromise) dbPromise = connectDatabase();
  dbPromise.then(() => next()).catch(next);
});

app.use(cors());
// Allow larger payloads for profile photo upload (base64); default is 100kb
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Niolla PM API is running' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/inquiries', inquiryRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/proposals', proposalRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/google-oauth', getOAuthStartRouter());
app.get('/oauth2callback', handleOAuthCallback);
app.get('/api/oauth2callback', handleOAuthCallback);

app.use(errorHandler);
