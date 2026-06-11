import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../constants/symbols';
import type { CartSessionStore } from './cart-session-store';
import { ICartService } from '../../interfaces/cart-service.interface';
import { ISalesforceCartClient } from '../../interfaces/salesforce-cart-client.interface';
import { AddItemPayload, CartContext, CartItem } from '../../types/cart.types';
import { SalesforceError } from '../../errors/app.errors';

/**
 * Orchestrates cart operations with transparent Salesforce context renewal.
 *
 * Retry pattern:
 * - On CONTEXT_EXPIRED: delete stale store entry → create fresh context →
 *   retry the original operation exactly once.
 * - If the retry also fails, the error propagates (no infinite loops).
 * - Non-expiry errors propagate immediately without retry.
 */
@injectable()
export class CartService implements ICartService {
  constructor(
    @inject(TYPES.SalesforceCartClient)
    private readonly client: ISalesforceCartClient,

    @inject(TYPES.CartSessionStore)
    private readonly store: CartSessionStore,
  ) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  async addItem(
    sessionId: string,
    cartId: string,
    payload: AddItemPayload,
  ): Promise<CartItem> {
    return this.withRetry(sessionId, cartId, (ctxId) =>
      this.client.addItem(ctxId, payload),
    );
  }

  

  // ─── Private ──────────────────────────────────────────────────────────────

  /** Returns cached context for session, or creates and caches a new one. */
  private async resolveContext(sessionId: string, cartId: string): Promise<CartContext> {
    const existing = this.store.get(sessionId);
    if (existing) {
      return existing;
    }
    const ctx = await this.client.createContext(cartId);
    this.store.set(sessionId, ctx);
    return ctx;
  }

  /**
   * Executes an operation against the Salesforce client with single-retry
   * semantics on CONTEXT_EXPIRED.
   */
  private async withRetry<T>(
    sessionId: string,
    cartId: string,
    operation: (contextId: string) => Promise<T>,
  ): Promise<T> {
    const ctx = await this.resolveContext(sessionId, cartId);

    try {
      return await operation(ctx.contextId);
    } catch (err) {
      if (err instanceof SalesforceError && err.code === 'CONTEXT_EXPIRED') {
        this.store.delete(sessionId);
        const freshCtx = await this.client.createContext(cartId);
        this.store.set(sessionId, freshCtx);
        // Single retry — intentionally no second catch
        return operation(freshCtx.contextId);
      }
      throw err;
    }
  }
}
