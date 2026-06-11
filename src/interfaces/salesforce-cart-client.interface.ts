import type { AddItemPayload, Cart, CartContext, CartItem } from '../types/cart.types';

/**
 * Contract for the Salesforce Cart client.
 * Implemented by the in-memory test double; a real Salesforce SDK adapter
 */
export interface ISalesforceCartClient {
  createContext(cartId: string): Promise<CartContext>;
  addItem(contextId: string, payload: AddItemPayload): Promise<CartItem>;
  getCart(contextId: string): Promise<Cart>;
}
