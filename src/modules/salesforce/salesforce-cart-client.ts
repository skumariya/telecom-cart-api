import 'reflect-metadata';
import { injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import type { ISalesforceCartClient } from '../../interfaces/salesforce-cart-client.interface';
import type { AddItemPayload, Cart, CartContext, CartItem } from '../../types/cart.types';
import { SalesforceError } from '../../errors/app.errors';

// ─── Internal State ────────────────────────────────────────────────────────────

interface InternalCart {
  cartId: string;
  items: Map<string, CartItem>;
  currency: string;
}

interface InternalContext {
  contextId: string;
  cartId: string;
  expiresAt: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 30_000; // Salesforce context lifetime: 30 seconds
const LATENCY_MS = 5; // Simulated network latency

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Client ────────────────────────────────────────────────────────────────────

/**
 * Test double for the Salesforce Cart API.
 * Behaviour:
 * - Maintains full in-memory cart + context state.
 * - Contexts expire after `ttlMs`; stale contextIds throw CONTEXT_EXPIRED.
 * - Pre-seeds `cart-001` and `cart-002` (the cart itself is owned by Salesforce;
 *   this Experience API only manages the ephemeral context on top of it).
 */
@injectable()
export class SalesforceCartClient implements ISalesforceCartClient {
  private readonly contexts = new Map<string, InternalContext>();
  private readonly carts = new Map<string, InternalCart>();
  private readonly ttlMs: number;
  private readonly delay: (ms: number) => Promise<void>;

  /** Zero-arg constructor — production defaults (30 s TTL, 5 ms latency). */
  constructor() {
    this.ttlMs = DEFAULT_TTL_MS;
    this.delay = wait;
    this.seedCarts();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async createContext(cartId: string): Promise<CartContext> {
    await this.delay(LATENCY_MS);
    if (!this.carts.has(cartId)) {
      throw new SalesforceError('NOT_FOUND', `Cart '${cartId}' not found`);
    }
    const contextId = uuidv4();
    const expiresAt = Date.now() + this.ttlMs;
    this.contexts.set(contextId, { contextId, cartId, expiresAt });
    return { contextId, expiresAt };
  }

  async addItem(contextId: string, payload: AddItemPayload): Promise<CartItem> {
    await this.delay(LATENCY_MS);
    const { cart } = this.resolveContext(contextId);
    this.assertAddItemPayload(payload);

    const itemId = uuidv4();
    const cartItem: CartItem = {
      itemId,
      productId: payload.productId,
      productName: payload.productName,
      quantity: payload.quantity,
      unitPrice: payload.unitPrice,
      totalPrice: this.round(payload.unitPrice * payload.quantity),
    };
    cart.items.set(itemId, cartItem);
    return cartItem;
  }

  async getCart(contextId: string): Promise<Cart> {
    await this.delay(LATENCY_MS);
    const { cart } = this.resolveContext(contextId);
    const items = Array.from(cart.items.values());
    const totalAmount = this.round(items.reduce((sum, i) => sum + i.totalPrice, 0));
    return { cartId: cart.cartId, items, totalAmount, currency: cart.currency };
  }

  async updateItemQty(contextId: string, itemId: string, qty: number): Promise<CartItem> {
    await this.delay(LATENCY_MS);
    const { cart } = this.resolveContext(contextId);

    if (!Number.isInteger(qty) || qty < 1) {
      throw new SalesforceError('VALIDATION', 'qty must be an integer >= 1');
    }
    const item = cart.items.get(itemId);
    if (!item) {
      throw new SalesforceError('NOT_FOUND', `Item '${itemId}' not found in cart`);
    }
    const updated: CartItem = {
      ...item,
      quantity: qty,
      totalPrice: this.round(item.unitPrice * qty),
    };
    cart.items.set(itemId, updated);
    return updated;
  }

  async removeItem(contextId: string, itemId: string): Promise<void> {
    await this.delay(LATENCY_MS);
    const { cart } = this.resolveContext(contextId);
    if (!cart.items.has(itemId)) {
      throw new SalesforceError('NOT_FOUND', `Item '${itemId}' not found in cart`);
    }
    cart.items.delete(itemId);
  }
 

  // ─── Private ─────────────────────────────────────────────────────────────────

  /** Resolves contextId → context + cart. Throws CONTEXT_EXPIRED past TTL. */
  private resolveContext(contextId: string): { ctx: InternalContext; cart: InternalCart } {
    const ctx = this.contexts.get(contextId);
    if (!ctx) {
      throw new SalesforceError(
        'CONTEXT_EXPIRED',
        `Context '${contextId}' not found or expired`,
      );
    }
    if (Date.now() > ctx.expiresAt) {
      this.contexts.delete(contextId); // clean up stale entry
      throw new SalesforceError('CONTEXT_EXPIRED', `Context '${contextId}' has expired`);
    }
    const cart = this.carts.get(ctx.cartId);
    if (!cart) {
      throw new SalesforceError('NOT_FOUND', `Cart for context '${contextId}' not found`);
    }
    return { ctx, cart };
  }

  private assertAddItemPayload(p: AddItemPayload): void {
    if (!p.productId?.trim()) {
      throw new SalesforceError('VALIDATION', 'productId is required');
    }
    if (!p.productName?.trim()) {
      throw new SalesforceError('VALIDATION', 'productName is required');
    }
    if (!Number.isInteger(p.quantity) || p.quantity < 1) {
      throw new SalesforceError('VALIDATION', 'quantity must be an integer >= 1');
    }
    if (typeof p.unitPrice !== 'number' || p.unitPrice < 0) {
      throw new SalesforceError('VALIDATION', 'unitPrice must be >= 0');
    }
  }

  private round(n: number): number {
    return parseFloat(n.toFixed(2));
  }

  private seedCarts(): void {
    const seeded: InternalCart[] = [
      { cartId: 'cart-001', items: new Map(), currency: 'INR' },
      { cartId: 'cart-002', items: new Map(), currency: 'INR' },
    ];
    seeded.forEach((c) => this.carts.set(c.cartId, c));
  }
}
