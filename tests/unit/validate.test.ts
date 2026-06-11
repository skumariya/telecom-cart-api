import 'reflect-metadata';
import { validateDto } from '../../src/utils/validate';
import { AddItemDto } from '../../src/dtos/add-item.dto';
import { UpdateItemQtyDto } from '../../src/dtos/update-item-qty.dto';
import { ValidationError } from '../../src/errors/app.errors';

describe('validateDto (class-validator)', () => {
  // ─── AddItemDto ────────────────────────────────────────────────────────────

  describe('AddItemDto', () => {
    const valid = {
      productId: 'p1',
      productName: 'Unlimited Plan',
      quantity: 1,
      unitPrice: 49.99,
    };

    it('passes with a valid body and returns a typed instance', async () => {
      const dto = await validateDto(AddItemDto, valid);
      expect(dto.productId).toBe('p1');
      expect(dto.quantity).toBe(1);
    });

    it('allows unitPrice of 0 (free item)', async () => {
      await expect(
        validateDto(AddItemDto, { ...valid, unitPrice: 0 }),
      ).resolves.toBeDefined();
    });

    it('throws ValidationError when productId is an empty string', async () => {
      await expect(
        validateDto(AddItemDto, { ...valid, productId: '' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when productName is missing', async () => {
      const { productName: _omitted, ...body } = valid;
      await expect(validateDto(AddItemDto, body)).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when quantity is 0', async () => {
      await expect(
        validateDto(AddItemDto, { ...valid, quantity: 0 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when quantity is a float', async () => {
      await expect(
        validateDto(AddItemDto, { ...valid, quantity: 1.5 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws ValidationError when unitPrice is negative', async () => {
      await expect(
        validateDto(AddItemDto, { ...valid, unitPrice: -1 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('includes per-field error messages in details', async () => {
      await expect(
        validateDto(AddItemDto, { ...valid, quantity: 0 }),
      ).rejects.toMatchObject({
        details: expect.arrayContaining([expect.stringContaining('quantity')]),
      });
    });
  });

  // ─── UpdateItemQtyDto ──────────────────────────────────────────────────────

  describe('UpdateItemQtyDto', () => {
    it('passes for quantity >= 1', async () => {
      const dto = await validateDto(UpdateItemQtyDto, { quantity: 5 });
      expect(dto.quantity).toBe(5);
    });

    it('throws when quantity is 0', async () => {
      await expect(
        validateDto(UpdateItemQtyDto, { quantity: 0 }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws when quantity is missing', async () => {
      await expect(validateDto(UpdateItemQtyDto, {})).rejects.toBeInstanceOf(
        ValidationError,
      );
    });

    it('throws when quantity is a string', async () => {
      await expect(
        validateDto(UpdateItemQtyDto, { quantity: '3' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
