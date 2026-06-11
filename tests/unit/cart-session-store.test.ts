import 'reflect-metadata';
import { CartSessionStore } from '../../src/modules/cart/cart-session-store';
import type { CartContext } from '../../src/types/cart.types';

describe('CartSessionStore', () => {
  let store: CartSessionStore;

  beforeEach(() => {
    store = new CartSessionStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── set / get ─────────────────────────────────────────────────────────────

  it('stores and retrieves a context by sessionId', () => {
    const ctx: CartContext = { contextId: 'ctx-1', expiresAt: Date.now() + 30_000 };
    store.set('sess-1', ctx);
    expect(store.get('sess-1')).toEqual(ctx);
  });

  it('returns undefined for an unknown sessionId', () => {
    expect(store.get('unknown')).toBeUndefined();
  });

  it('overwrites an existing context on duplicate sessionId', () => {
    const ctx1: CartContext = { contextId: 'ctx-1', expiresAt: Date.now() + 30_000 };
    const ctx2: CartContext = { contextId: 'ctx-2', expiresAt: Date.now() + 60_000 };
    store.set('sess-1', ctx1);
    store.set('sess-1', ctx2);
    expect(store.get('sess-1')).toEqual(ctx2);
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  it('deletes a context entry', () => {
    store.set('sess-1', { contextId: 'ctx-1', expiresAt: Date.now() + 30_000 });
    store.delete('sess-1');
    expect(store.get('sess-1')).toBeUndefined();
  });

  it('does not throw when deleting a non-existent session', () => {
    expect(() => store.delete('no-such')).not.toThrow();
  });

  // ─── isExpired — critical path ─────────────────────────────────────────────

  it('returns false for a context that has not yet expired', () => {
    const ctx: CartContext = { contextId: 'ctx-1', expiresAt: Date.now() + 30_000 };
    expect(store.isExpired(ctx)).toBe(false);
  });

  it('returns true for a context with expiresAt in the past', () => {
    const ctx: CartContext = { contextId: 'ctx-1', expiresAt: Date.now() - 1 };
    expect(store.isExpired(ctx)).toBe(true);
  });

  it('returns true after fake time advances past the TTL', () => {
    jest.useFakeTimers();
    const ctx: CartContext = { contextId: 'ctx-1', expiresAt: Date.now() + 1_000 };
    jest.advanceTimersByTime(2_000);
    expect(store.isExpired(ctx)).toBe(true);
  });

  // ─── size ──────────────────────────────────────────────────────────────────

  it('tracks the number of stored sessions', () => {
    expect(store.size()).toBe(0);
    store.set('s1', { contextId: 'c1', expiresAt: Date.now() + 30_000 });
    store.set('s2', { contextId: 'c2', expiresAt: Date.now() + 30_000 });
    expect(store.size()).toBe(2);
    store.delete('s1');
    expect(store.size()).toBe(1);
  });
});
