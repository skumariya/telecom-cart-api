import { Router } from 'express';
import type { Container } from 'inversify';
import { TYPES } from '../constants/symbols';
import type { CartController } from '../controllers/cart.controller';

/** Binds CartController handler methods to the Express router. */
export function buildRouter(container: Container): Router {
  const router = Router();
  const ctrl = container.get<CartController>(TYPES.CartController);

  // Carts endpoints
  router.post('/carts/:cartId/items', ctrl.addItem);
  router.get('/carts/:cartId', ctrl.getCart);
  router.delete('/carts/:cartId/items/:itemId', ctrl.removeItem);
  router.patch('/carts/:cartId/items/:itemId', ctrl.updateItemQty);

  return router;
}
