/**
 * Inversify Symbol tokens for dependency injection.
 * Symbols prevent string-literal collisions across modules.
 */
export const TYPES = {
  CartController: Symbol.for('CartController'),
} as const;
