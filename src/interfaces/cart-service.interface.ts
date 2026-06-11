import type { AddItemPayload, Cart, CartContext, CartItem } from '../types/cart.types';

export interface ICartService {
  addItem(sessionId: string, cartId: string, payload: AddItemPayload): Promise<CartItem>;
  getCart(sessionId: string, cartId: string): Promise<Cart>;
  updateItemQty(
    sessionId: string,
    cartId: string,
    itemId: string,
    qty: number,
  ): Promise<CartItem>;
  removeItem(sessionId: string, cartId: string, itemId: string): Promise<void>;
}
