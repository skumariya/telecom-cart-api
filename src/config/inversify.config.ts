import 'reflect-metadata';
import { Container } from 'inversify';
import { CartController } from '../controllers/cart.controller';
import { TYPES } from '../constants/symbols';


/**
 * Builds the Inversify IoC container.
 *
 * Exported as a factory so:
 * - production code calls buildContainer() once at startup
 *
 */
export function buildContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });

  // controller binding
  container.bind<CartController>(TYPES.CartController).to(CartController);
  
  return container;
}
