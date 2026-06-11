import { Router } from 'express';
import type { Container } from 'inversify';
import { TYPES } from '../constants/symbols';
import type { CartController } from '../controllers/cart.controller';

/** Binds CartController handler methods to the Express router. */
export function buildRouter(container: Container): Router {
  const router = Router();
  const ctrl = container.get<CartController>(TYPES.CartController);

  // Carts endpoints
  router.get('/carts', ctrl.getCart);

  return router;
}
