import 'reflect-metadata';
import { injectable } from 'inversify';
import type { NextFunction, Request, Response } from 'express';
import { HttpStatus } from '../constants/http-status';


@injectable()
export class CartController {
  constructor() {}


  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.status(HttpStatus.OK).json({"meessage": "get cart api test"});
  };

 
}
