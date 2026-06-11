import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import type { NextFunction, Request, Response } from 'express';
import { HttpStatus } from '../constants/http-status';
import { MissingSessionError } from '../errors/app.errors';
import { TYPES } from '../constants/symbols';
import { ICartService } from '../interfaces/cart-service.interface';
import { validateDto } from '../utils/validate';
import { AddItemDto } from '../dtos/add-item.dto';

@injectable()
export class CartController {
  constructor(
    @inject(TYPES.CartService)
    private readonly cartService: ICartService,
  ) {}


  // ─── POST /carts/:cartId/items ─────────────────────────────────────────────

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = this.extractSession(req);
      const requestItem = await validateDto(AddItemDto, req.body);
      const item = await this.cartService.addItem(sessionId, req.params.cartId, {
        productId: requestItem.productId,
        productName: requestItem.productName,
        quantity: requestItem.quantity,
        unitPrice: requestItem.unitPrice,
      });
      res.status(HttpStatus.CREATED).json(item);
    } catch (err) {
      next(err);
    }
  };

  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.status(HttpStatus.OK).json({"meessage": "get cart api test"});
  };


  // ─── Private ──────────────────────────────────────────────────────────────

  private extractSession(req: Request): string {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId || typeof sessionId !== 'string') {
      throw new MissingSessionError();
    }
    return sessionId;
  }
 
}
