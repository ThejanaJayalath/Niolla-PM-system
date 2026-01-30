import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(err: ApiError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? 'INTERNAL_ERROR';
  const message = err.message ?? 'An unexpected error occurred';

  console.error(err);

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
