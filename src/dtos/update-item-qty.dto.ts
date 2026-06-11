import { IsInt, Min } from 'class-validator';

/** Request body DTO for PATCH /carts/:cartId/items/:itemId */
export class UpdateItemQtyDto {
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;
}
