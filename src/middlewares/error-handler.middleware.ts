import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { HttpStatus } from '../constants/http-status';
import {
  MissingSessionError,
  SalesforceError,
  ValidationError,
} from '../errors/app.errors';

interface ErrorResponse {
  error: string;
  code: string;
  details?: string[];
}

/**
 * Central error handler — must be registered last in the middleware chain.
 *
 * Error → HTTP status mapping:
 *   MissingSessionError                  → 400 MISSING_SESSION
 *   ValidationError (DTO)                → 422 VALIDATION (+ details)
 *   SalesforceError(CONTEXT_EXPIRED)     → 503
 *   SalesforceError(NOT_FOUND)           → 404
 *   SalesforceError(VALIDATION)          → 400
 *   anything else                        → 500 INTERNAL
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof MissingSessionError) {
    const body: ErrorResponse = { error: err.message, code: 'MISSING_SESSION' };
    res.status(HttpStatus.BAD_REQUEST).json(body);
    return;
  }

  if (err instanceof ValidationError) {
    const body: ErrorResponse = {
      error: err.message,
      code: 'VALIDATION',
      details: err.details,
    };
    res.status(HttpStatus.UNPROCESSABLE).json(body);
    return;
  }

  if (err instanceof SalesforceError) {
    const body: ErrorResponse = { error: err.message, code: err.code };
    res.status(sfCodeToStatus(err.code)).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  res.status(HttpStatus.INTERNAL_ERROR).json({ error: message, code: 'INTERNAL' });
};

function sfCodeToStatus(code: string): number {
  switch (code) {
    case 'CONTEXT_EXPIRED':
      return HttpStatus.SERVICE_UNAVAILABLE;
    case 'NOT_FOUND':
      return HttpStatus.NOT_FOUND;
    case 'VALIDATION':
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_ERROR;
  }
}
