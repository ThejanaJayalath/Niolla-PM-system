import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import inquiryRoutes from './routes/inquiryRoutes';
import reminderRoutes from './routes/reminderRoutes';
import proposalRoutes from './routes/proposalRoutes';
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
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Niolla PM API is running' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/inquiries', inquiryRoutes);
app.use('/api/v1/reminders', reminderRoutes);
app.use('/api/v1/proposals', proposalRoutes);

app.use(errorHandler);
