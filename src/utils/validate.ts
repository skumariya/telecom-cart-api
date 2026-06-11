import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationError } from '../errors/app.errors';

type ClassCtor<T> = new (...args: any[]) => T;

/**
 * Transforms a plain request body into a typed DTO instance and validates it
 * against class-validator decorators.
 *
 * @throws ValidationError with per-field messages when any constraint fails.
 */

export async function validateDto<T extends Record<string, any>>(
  cls: ClassCtor<T>,
  plain: unknown,
): Promise<T> {
  const instance = plainToInstance(cls, plain) as T;
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: false,
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const details = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    throw new ValidationError('Request validation failed', details);
  }

  return instance;
}
