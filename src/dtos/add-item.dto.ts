import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

/** Request body DTO for POST /carts/:cartId/items */
export class AddItemDto {
  @IsString()
  @IsNotEmpty({ message: 'productId must not be empty' })
  productId!: string;

  @IsString()
  @IsNotEmpty({ message: 'productName must not be empty' })
  productName!: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;

  @IsNumber({}, { message: 'unitPrice must be a number' })
  @Min(0, { message: 'unitPrice must be >= 0' })
  unitPrice!: number;
}
