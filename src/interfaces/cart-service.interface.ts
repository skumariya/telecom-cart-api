import type { AddItemPayload, CartItem } from '../types/cart.types';

export interface ICartService {
  addItem(sessionId: string, cartId: string, payload: AddItemPayload): Promise<CartItem>;
  
}
