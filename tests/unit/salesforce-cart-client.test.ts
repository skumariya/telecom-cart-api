import 'reflect-metadata';
import { SalesforceCartClient } from '../../src/modules/salesforce/salesforce-cart-client';

/**
 * All tests use the static factory with simulateLatency=false — no real timers,
 * sub-second suite. The zero-arg DI constructor is never parameterised in tests.
 */
function makeClient(ttlMs = 100): SalesforceCartClient {
  return SalesforceCartClient.create({ ttlMs, simulateLatency: false });
}

describe('SalesforceCartClient (test double)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── createContext ─────────────────────────────────────────────────────────

  describe('createContext', () => {
    it('returns a context with a non-empty contextId and future expiresAt', async () => {
      const client = makeClient();
      const before = Date.now();
      const ctx = await client.createContext('cart-001');

      expect(typeof ctx.contextId).toBe('string');
      expect(ctx.contextId).toBeTruthy();
      expect(ctx.expiresAt).toBeGreaterThan(before);
    });

    it('throws NOT_FOUND for an unknown cartId', async () => {
      const client = makeClient();
      await expect(client.createContext('bad-cart')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // ─── addItem ───────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('returns a CartItem with correctly computed totalPrice', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      const item = await client.addItem(ctx.contextId, {
        productId: 'p1',
        productName: 'Unlimited Plan',
        quantity: 2,
        unitPrice: 49.99,
      });

      expect(item.itemId).toBeTruthy();
      expect(item.totalPrice).toBeCloseTo(99.98, 2);
    });

    it('throws CONTEXT_EXPIRED when the TTL has passed — critical path', async () => {
      jest.useFakeTimers();
      const client = SalesforceCartClient.create({ ttlMs: 100, simulateLatency: false });
      const ctx = await client.createContext('cart-001');

      jest.advanceTimersByTime(200); // jump past the 100 ms TTL

      await expect(
        client.addItem(ctx.contextId, {
          productId: 'p1',
          productName: 'Plan',
          quantity: 1,
          unitPrice: 10,
        }),
      ).rejects.toMatchObject({ code: 'CONTEXT_EXPIRED' });
    });

    it('throws VALIDATION when quantity is 0', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      await expect(
        client.addItem(ctx.contextId, {
          productId: 'p1',
          productName: 'Plan',
          quantity: 0,
          unitPrice: 10,
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });

  // ─── removeItem ────────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('removes an item so getCart no longer contains it', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      const item = await client.addItem(ctx.contextId, {
        productId: 'p1',
        productName: 'Plan',
        quantity: 1,
        unitPrice: 10,
      });

      await client.removeItem(ctx.contextId, item.itemId);

      const cart = await client.getCart(ctx.contextId);
      expect(cart.items).toHaveLength(0);
    });

    it('throws NOT_FOUND for a non-existent itemId', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      await expect(client.removeItem(ctx.contextId, 'ghost')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // ─── getCart ───────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('returns correct totalAmount after multiple addItem calls', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      await client.addItem(ctx.contextId, {
        productId: 'p1',
        productName: 'A',
        quantity: 2,
        unitPrice: 50,
      });
      await client.addItem(ctx.contextId, {
        productId: 'p2',
        productName: 'B',
        quantity: 1,
        unitPrice: 30,
      });

      const cart = await client.getCart(ctx.contextId);
      expect(cart.items).toHaveLength(2);
      expect(cart.totalAmount).toBeCloseTo(130, 2);
      expect(cart.currency).toBe('INR');
    });
  });

  // ─── updateItemQty ─────────────────────────────────────────────────────────

  describe('updateItemQty', () => {
    it('recalculates totalPrice after a quantity update', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      const item = await client.addItem(ctx.contextId, {
        productId: 'p1',
        productName: 'Plan',
        quantity: 1,
        unitPrice: 20,
      });

      const updated = await client.updateItemQty(ctx.contextId, item.itemId, 3);
      expect(updated.quantity).toBe(3);
      expect(updated.totalPrice).toBeCloseTo(60, 2);
    });

    it('throws NOT_FOUND for an unknown itemId', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      await expect(client.updateItemQty(ctx.contextId, 'ghost', 2)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws VALIDATION when qty is 0', async () => {
      const client = makeClient();
      const ctx = await client.createContext('cart-001');
      const item = await client.addItem(ctx.contextId, {
        productId: 'p1',
        productName: 'Plan',
        quantity: 1,
        unitPrice: 10,
      });

      await expect(
        client.updateItemQty(ctx.contextId, item.itemId, 0),
      ).rejects.toMatchObject({ code: 'VALIDATION' });
    });
  });
});
