// ─── Domain Types ──────────────────────────────────────────────────────────────

export interface CartContext {
  contextId: string;
  expiresAt: number; // Unix ms timestamp
}

export interface CartItem {
  itemId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Cart {
  cartId: string;
  items: CartItem[];
  totalAmount: number;
  currency: string;
}

export interface AddItemPayload {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}