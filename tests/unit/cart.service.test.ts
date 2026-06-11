import 'reflect-metadata';
import { CartService } from '../../src/modules/cart/cart.service';
import { CartSessionStore } from '../../src/modules/cart/cart-session-store';
import { SalesforceError } from '../../src/errors/app.errors';
import type { ISalesforceCartClient } from '../../src/interfaces/salesforce-cart-client.interface';
import type {
  AddItemPayload,
  Cart,
  CartContext,
  CartItem,
} from '../../src/types/cart.types';

// ─── Mock Factory ─────────────────────────────────────────────────────────────

function makeMockClient(): jest.Mocked<ISalesforceCartClient> {
  return {
    createContext: jest.fn(),
    addItem: jest.fn(),
    removeItem: jest.fn(),
    getCart: jest.fn(),
    updateItemQty: jest.fn(),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION = 'sess-abc';
const CART_ID = 'cart-001';
const ITEM_ID = 'item-xyz';

const ctx: CartContext = { contextId: 'ctx-old', expiresAt: Date.now() + 30_000 };
const freshCtx: CartContext = { contextId: 'ctx-fresh', expiresAt: Date.now() + 30_000 };

const sampleItem: CartItem = {
  itemId: ITEM_ID,
  productId: 'p1',
  productName: 'Plan A',
  quantity: 1,
  unitPrice: 49.99,
  totalPrice: 49.99,
};

const sampleCart: Cart = {
  cartId: CART_ID,
  items: [sampleItem],
  totalAmount: 49.99,
  currency: 'INR',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CartService', () => {
  let mockClient: jest.Mocked<ISalesforceCartClient>;
  let store: CartSessionStore;
  let service: CartService;

  beforeEach(() => {
    mockClient = makeMockClient();
    store = new CartSessionStore();
    // Direct instantiation — unit tests bypass Inversify intentionally
    service = new CartService(mockClient, store);
  });

  // ─── getOrCreateContext ──────────────────────────────────────────────────

  describe('getOrCreateContext', () => {
    it('creates and caches a new context when none exists', async () => {
      mockClient.createContext.mockResolvedValue(ctx);

      const result = await service.getOrCreateContext(SESSION, CART_ID);

      expect(result).toEqual(ctx);
      expect(mockClient.createContext).toHaveBeenCalledWith(CART_ID);
      expect(store.get(SESSION)).toEqual(ctx);
    });

    it('returns cached context without calling createContext again', async () => {
      store.set(SESSION, ctx);

      const result = await service.getOrCreateContext(SESSION, CART_ID);

      expect(result).toEqual(ctx);
      expect(mockClient.createContext).not.toHaveBeenCalled();
    });
  });

  // ─── Retry on CONTEXT_EXPIRED — critical path 1 ──────────────────────────

  describe('retry on CONTEXT_EXPIRED', () => {
    it('retries exactly once and succeeds when first call hits an expired context', async () => {
      store.set(SESSION, ctx);

      mockClient.getCart
        .mockRejectedValueOnce(new SalesforceError('CONTEXT_EXPIRED', 'expired'))
        .mockResolvedValueOnce(sampleCart);

      mockClient.createContext.mockResolvedValue(freshCtx);

      const result = await service.getCart(SESSION, CART_ID);

      expect(result).toEqual(sampleCart);
      expect(mockClient.createContext).toHaveBeenCalledTimes(1);
      expect(mockClient.getCart).toHaveBeenCalledTimes(2);
      expect(mockClient.getCart).toHaveBeenNthCalledWith(1, 'ctx-old');
      expect(mockClient.getCart).toHaveBeenNthCalledWith(2, 'ctx-fresh');
      expect(store.get(SESSION)).toEqual(freshCtx);
    });

    it('propagates the error when the retry also fails — critical path 2', async () => {
      store.set(SESSION, ctx);

      mockClient.getCart
        .mockRejectedValueOnce(new SalesforceError('CONTEXT_EXPIRED', 'expired'))
        .mockRejectedValueOnce(new SalesforceError('INTERNAL', 'SF outage'));

      mockClient.createContext.mockResolvedValue(freshCtx);

      await expect(service.getCart(SESSION, CART_ID)).rejects.toMatchObject({
        code: 'INTERNAL',
        message: 'SF outage',
      });

      // Exactly two attempts — never more
      expect(mockClient.getCart).toHaveBeenCalledTimes(2);
    });

    it('does NOT retry for non-CONTEXT_EXPIRED errors', async () => {
      store.set(SESSION, ctx);

      mockClient.getCart.mockRejectedValue(
        new SalesforceError('NOT_FOUND', 'Cart not found'),
      );

      await expect(service.getCart(SESSION, CART_ID)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });

      expect(mockClient.getCart).toHaveBeenCalledTimes(1);
      expect(mockClient.createContext).not.toHaveBeenCalled();
    });
  });

  // ─── addItem ─────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('adds an item using the existing context', async () => {
      store.set(SESSION, ctx);
      mockClient.addItem.mockResolvedValue(sampleItem);

      const payload: AddItemPayload = {
        productId: 'p1',
        productName: 'Plan A',
        quantity: 1,
        unitPrice: 49.99,
      };
      const result = await service.addItem(SESSION, CART_ID, payload);

      expect(result).toEqual(sampleItem);
      expect(mockClient.addItem).toHaveBeenCalledWith('ctx-old', payload);
    });
  });

  // ─── removeItem ──────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('calls client.removeItem with the resolved contextId', async () => {
      store.set(SESSION, ctx);
      mockClient.removeItem.mockResolvedValue(undefined);

      await expect(service.removeItem(SESSION, CART_ID, ITEM_ID)).resolves.toBeUndefined();
      expect(mockClient.removeItem).toHaveBeenCalledWith('ctx-old', ITEM_ID);
    });
  });

  // ─── updateItemQty ───────────────────────────────────────────────────────

  describe('updateItemQty', () => {
    it('updates quantity and returns the updated item', async () => {
      store.set(SESSION, ctx);
      const updated = { ...sampleItem, quantity: 3, totalPrice: 149.97 };
      mockClient.updateItemQty.mockResolvedValue(updated);

      const result = await service.updateItemQty(SESSION, CART_ID, ITEM_ID, 3);

      expect(result).toEqual(updated);
      expect(mockClient.updateItemQty).toHaveBeenCalledWith('ctx-old', ITEM_ID, 3);
    });
  });
});
