import 'reflect-metadata';
import { Container } from 'inversify';
import { CartController } from '../controllers/cart.controller';
import { TYPES } from '../constants/symbols';
import { ICartService } from '../interfaces/cart-service.interface';
import { CartService } from '../modules/cart/cart.service';
import { CartSessionStore } from '../modules/cart/cart-session-store';
import { ISalesforceCartClient } from '../interfaces/salesforce-cart-client.interface';
import { SalesforceCartClient } from '../modules/salesforce/salesforce-cart-client';


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

  // services binding
  container.bind<ICartService>(TYPES.CartService).to(CartService);

  container.bind<CartSessionStore>(TYPES.CartSessionStore).to(CartSessionStore);

  container
    .bind<ISalesforceCartClient>(TYPES.SalesforceCartClient)
    .to(SalesforceCartClient);
  
  return container;
}
