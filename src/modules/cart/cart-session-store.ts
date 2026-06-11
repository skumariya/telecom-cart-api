import 'reflect-metadata';
import { injectable } from 'inversify';
import type { CartContext } from '../../types/cart.types';

/**
 * In-memory store: sessionId → CartContext.
 * Pure class — no I/O, no side effects. All methods synchronous.
 * Process restart clears all sessions (acceptable per assessment constraints).
 */
@injectable()
export class CartSessionStore {
  private readonly store = new Map<string, CartContext>();

  set(sessionId: string, ctx: CartContext): void {
    this.store.set(sessionId, ctx);
  }

  get(sessionId: string): CartContext | undefined {
    return this.store.get(sessionId);
  }

  delete(sessionId: string): void {
    this.store.delete(sessionId);
  }

  /** True when the context TTL has passed. */
  isExpired(ctx: CartContext): boolean {
    return Date.now() > ctx.expiresAt;
  }

  /** Number of active sessions — useful for diagnostics and tests. */
  size(): number {
    return this.store.size;
  }
}
