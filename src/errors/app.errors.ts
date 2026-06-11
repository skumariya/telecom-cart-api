export type SalesforceErrorCode =
  | 'CONTEXT_EXPIRED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'INTERNAL';

/**
 * Error thrown by the Salesforce client layer.
 */
export class SalesforceError extends Error {
  public readonly code: SalesforceErrorCode;

  constructor(code: SalesforceErrorCode, message: string) {
    super(message);
    this.name = 'SalesforceError';
    this.code = code;
    Object.setPrototypeOf(this, SalesforceError.prototype);
  }
}

/** Thrown when a request body fails class-validator DTO constraints. */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details: string[],
  ) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/** Thrown when the x-session-id header is missing from a cart request. */
export class MissingSessionError extends Error {
  constructor() {
    super('x-session-id header is required');
    this.name = 'MissingSessionError';
    Object.setPrototypeOf(this, MissingSessionError.prototype);
  }
}
