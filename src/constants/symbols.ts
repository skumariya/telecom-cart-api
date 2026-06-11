/**
 * Inversify Symbol tokens for dependency injection.
 * Symbols prevent string-literal collisions across modules.
 */
export const TYPES = {
  CartController: Symbol.for('CartController'),
  CartService: Symbol.for('CartService'),
  CartSessionStore: Symbol.for('CartSessionStore'),
  SalesforceCartClient: Symbol.for('SalesforceCartClient')
} as const;
