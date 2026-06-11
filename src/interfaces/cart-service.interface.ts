import type { AddItemPayload, Cart, CartItem } from '../types/cart.types';

export interface ICartService {
  addItem(sessionId: string, cartId: string, payload: AddItemPayload): Promise<CartItem>;
  getCart(sessionId: string, cartId: string): Promise<Cart>;
  
}
