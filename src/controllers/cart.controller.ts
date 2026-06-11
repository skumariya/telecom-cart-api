import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import type { NextFunction, Request, Response } from 'express';
import { HttpStatus } from '../constants/http-status';
import { MissingSessionError } from '../errors/app.errors';
import { TYPES } from '../constants/symbols';
import { ICartService } from '../interfaces/cart-service.interface';
import { validateDto } from '../utils/validate';
import { AddItemDto } from '../dtos/add-item.dto';
import { UpdateItemQtyDto } from '../dtos/update-item-qty.dto';

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

  // ─── GET /carts/:cartId ────────────────────────────────────────────────────

  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = this.extractSession(req);
      const cart = await this.cartService.getCart(sessionId, req.params.cartId);
      res.status(HttpStatus.OK).json(cart);
    } catch (err) {
      next(err);
    }
  };

  // ─── DELETE /carts/:cartId/items/:itemId ───────────────────────────────────

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = this.extractSession(req);
      await this.cartService.removeItem(sessionId, req.params.cartId, req.params.itemId);
      res.status(HttpStatus.NO_CONTENT).send();
    } catch (err) {
      next(err);
    }
  };

  // ─── PATCH /carts/:cartId/items/:itemId ────────────────────────────────────

  updateItemQty = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const sessionId = this.extractSession(req);
      const dto = await validateDto(UpdateItemQtyDto, req.body);
      const item = await this.cartService.updateItemQty(
        sessionId,
        req.params.cartId,
        req.params.itemId,
        dto.quantity,
      );
      res.status(HttpStatus.OK).json(item);
    } catch (err) {
      next(err);
    }
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
