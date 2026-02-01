import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import inquiryRoutes from './routes/inquiryRoutes';
import reminderRoutes from './routes/reminderRoutes';
import proposalRoutes from './routes/proposalRoutes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

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
