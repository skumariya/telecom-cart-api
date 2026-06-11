# SPEC-A: Architecture & Abstractions

> **Audience**: Claude Code (or any AI coding assistant).
> Paste this file verbatim together with SPEC-B-api.md into the implementation prompt.
> Implement every layer exactly as described. Do not add extra abstractions.

---

## 1. Goal

A thin **Experience API** (Express + TypeScript + Inversify DI) that powers a telecom cart
on top of a **non-persistent Salesforce cart context**. The cart itself is owned by
Salesforce (cartIds already exist); this API owns the ephemeral context lifecycle.

```
HTTP Client
     │
     ▼
Express App → CartController → CartService → SalesforceCartClient (test double)
                                    │
                               CartSessionStore (in-memory)
```

---

## 2. Folder Structure — implement exactly

```
src/
├── config/
│   ├── inversify.config.ts       # buildContainer(): Container
│   └── routes.config.ts          # buildRouter(container): Router
├── constants/
│   ├── http-status.ts            # HttpStatus const object
│   └── symbols.ts                # TYPES — Inversify Symbol tokens
├── controllers/
│   └── cart.controller.ts        # @injectable() — injects ICartService
├── dtos/
│   ├── add-item.dto.ts           # class-validator DTO
│   └── update-item-qty.dto.ts    # class-validator DTO
├── errors/
│   └── app.errors.ts             # SalesforceError · ValidationError · MissingSessionError
├── interfaces/
│   ├── cart-service.interface.ts
│   └── salesforce-cart-client.interface.ts
├── middlewares/
│   └── error-handler.middleware.ts
├── modules/
│   ├── cart/
│   │   ├── cart-session-store.ts # @injectable() — pure in-memory Map
│   │   └── cart.service.ts       # @injectable() — orchestration + single retry
│   └── salesforce/
│       └── salesforce-cart-client.ts  # @injectable() — test double
├── types/
│   └── cart.types.ts
├── utils/
│   └── validate.ts               # validateDto<T>(cls, plain): Promise<T>
├── app.ts                        # createApp(container?): Application
└── main.ts                       # entry point
```

---

## 3. Inversify Design Rules — non-negotiable

1. **Zero-primitive constructors.** Inversify resolves constructor parameters from the
   container; it cannot resolve `number`, `boolean`, or `string`. Every class bound in
   the container must have either a zero-arg constructor or parameters that are all
   `@inject(TYPES.X)`-decorated Symbol tokens.
2. **Test configuration goes through static factories**, never constructor parameters.
   `SalesforceCartClient.create({ ttlMs, simulateLatency })` exists for this.
3. **`import 'reflect-metadata'` is the first import** in every file using Inversify
   decorators, plus `app.ts` and `main.ts`, plus every test file.
4. **All bindings are Singleton scope** (`new Container({ defaultScope: 'Singleton' })`).
5. Symbol tokens live in one place:

```typescript
export const TYPES = {
  SalesforceCartClient: Symbol.for('SalesforceCartClient'),
  CartSessionStore: Symbol.for('CartSessionStore'),
  CartService: Symbol.for('CartService'),
  CartController: Symbol.for('CartController'),
} as const;
```

---

## 4. Domain Types — `src/types/cart.types.ts`

```typescript
export interface CartContext   { contextId: string; expiresAt: number; }
export interface CartItem      { itemId: string; productId: string; productName: string;
                                 quantity: number; unitPrice: number; totalPrice: number; }
export interface Cart          { cartId: string; items: CartItem[]; totalAmount: number; currency: string; }
export interface AddItemPayload { productId: string; productName: string; quantity: number; unitPrice: number; }
```

---

## 5. Error Types — `src/errors/app.errors.ts`

```typescript
export type SalesforceErrorCode = 'CONTEXT_EXPIRED' | 'NOT_FOUND' | 'VALIDATION' | 'INTERNAL';

export class SalesforceError extends Error {
  constructor(public readonly code: SalesforceErrorCode, message: string) { ... }
}
export class ValidationError extends Error {
  constructor(message: string, public readonly details: string[]) { ... }
}
export class MissingSessionError extends Error {
  constructor() { super('x-session-id header is required'); }
}
```

Every constructor body must include `Object.setPrototypeOf(this, <Class>.prototype)` so
`instanceof` checks work under ts-jest's transpilation.

---

## 6. SalesforceCartClient — test double

```typescript
@injectable()
export class SalesforceCartClient implements ISalesforceCartClient {
  /** Zero-arg constructor — production defaults: 30 s TTL, 5 ms simulated latency. */
  constructor() { ... }

  /** Static factory for tests: custom TTL, latency off. Bypasses DI. */
  static create(opts: { ttlMs?: number; simulateLatency?: boolean }): SalesforceCartClient { ... }
}
```

Behaviour:
- Full in-memory state: `Map<contextId, InternalContext>` + `Map<cartId, InternalCart>`.
- Pre-seeds `cart-001` and `cart-002` (carts are owned by Salesforce; no create-cart API).
- Every method awaits ~5 ms simulated latency (skippable via factory).
- `resolveContext(contextId)` throws `SalesforceError('CONTEXT_EXPIRED')` when the
  contextId is unknown **or** `Date.now() > expiresAt` (and deletes the stale entry).
- `createContext(cartId)` throws `NOT_FOUND` for unknown cartIds.
- Money values rounded to 2 decimals via `parseFloat(n.toFixed(2))`.

---

## 7. CartSessionStore

```typescript
@injectable()
export class CartSessionStore {
  set(sessionId: string, ctx: CartContext): void
  get(sessionId: string): CartContext | undefined
  delete(sessionId: string): void
  isExpired(ctx: CartContext): boolean   // Date.now() > ctx.expiresAt
  size(): number
}
```

Pure synchronous class — no I/O.

---

## 8. CartService — the single-retry pattern

```typescript
@injectable()
export class CartService implements ICartService {
  constructor(
    @inject(TYPES.SalesforceCartClient) private readonly client: ISalesforceCartClient,
    @inject(TYPES.CartSessionStore)     private readonly store: CartSessionStore,
  ) {}

  private async withRetry<T>(sessionId, cartId, operation): Promise<T> {
    const ctx = await this.resolveContext(sessionId, cartId);
    try {
      return await operation(ctx.contextId);
    } catch (err) {
      if (err instanceof SalesforceError && err.code === 'CONTEXT_EXPIRED') {
        this.store.delete(sessionId);
        const freshCtx = await this.client.createContext(cartId);
        this.store.set(sessionId, freshCtx);
        return operation(freshCtx.contextId);  // single retry — no second catch
      }
      throw err;
    }
  }
}
```

- `resolveContext` returns the cached context or creates + caches a new one.
- Public methods (`getCart`, `addItem`, `removeItem`, `updateItemQty`) all delegate
  through `withRetry`. `getOrCreateContext` exposes `resolveContext` directly.
- Non-expiry errors propagate immediately. The retry never loops.

---

## 9. CartController

- `@injectable()`, injects `ICartService` via `TYPES.CartService`.
- Handlers are arrow-function class properties (preserve `this` when passed to Express).
- Each handler: extract `x-session-id` (throw `MissingSessionError` if absent) →
  `await validateDto(Dto, req.body)` where a body exists → delegate → respond.
- Zero business logic. Errors forwarded with `next(err)`.

---

## 10. DTOs + validateDto

**AddItemDto**: `@IsString() @IsNotEmpty()` productId, productName ·
`@IsInt() @Min(1)` quantity · `@IsNumber() @Min(0)` unitPrice.

**UpdateItemQtyDto**: `@IsInt() @Min(1)` quantity.

```typescript
export async function validateDto<T extends Record<string, any>>(
  cls: new (...args: any[]) => T,
  plain: unknown,
): Promise<T> {
  const instance = plainToInstance(cls, plain) as T;
  const errors = await validate(instance as object, { whitelist: true, skipMissingProperties: false });
  if (errors.length > 0) {
    throw new ValidationError('Request validation failed',
      errors.flatMap(e => Object.values(e.constraints ?? {})));
  }
  return instance;
}
```

---

## 11. Error Handler — registered last

| Error | Status | code |
|-------|--------|------|
| `MissingSessionError` | 400 | `MISSING_SESSION` |
| `ValidationError` (DTO) | 422 | `VALIDATION` (+ `details: string[]`) |
| `SalesforceError('CONTEXT_EXPIRED')` | 503 | `CONTEXT_EXPIRED` |
| `SalesforceError('NOT_FOUND')` | 404 | `NOT_FOUND` |
| `SalesforceError('VALIDATION')` | 400 | `VALIDATION` |
| anything else | 500 | `INTERNAL` |

Response shape: `{ error: string, code: string, details?: string[] }`.

---

## 12. App Factory

```typescript
export function createApp(container?: Container): Application {
  const app = express();
  app.use(express.json());
  app.disable('x-powered-by');
  app.use('/api/v1', buildRouter(container ?? buildContainer()));
  app.use(errorHandlerMiddleware);   // must be last
  return app;
}
```

---

## 13. Tooling Config

**tsconfig.json** — `module: "commonjs"`, `target: "ES2022"`, `strict: true`,
`experimentalDecorators: true`, `emitDecoratorMetadata: true`.

**jest.config.js** — ts-jest configured inside the `transform` block (modern format):

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: { experimentalDecorators: true, emitDecoratorMetadata: true,
                  strict: true, esModuleInterop: true },
    }],
  },
};
```

---

## 14. Testing Strategy

- **Unit** (`tests/unit/`): direct instantiation, no Inversify. `jest.Mocked<ISalesforceCartClient>`
  built from `jest.fn()`. SalesforceCartClient tests use the static factory with
  `simulateLatency: false`.
- **Integration** (`tests/integration/`): isolated Container per suite,
  `toConstantValue(mockClient)` for the client binding, Supertest against `createApp(container)`.
- Fake-timer expiry tests pair `jest.useFakeTimers()` with `afterEach(() => jest.useRealTimers())`.

### Critical paths — all must be covered

1. CartService retries exactly once on CONTEXT_EXPIRED and succeeds
   (createContext ×1, operation ×2, store holds the fresh context).
2. CartService propagates the error when the retry also fails (operation ×2, never more).
3. CartService does not retry non-expiry errors (operation ×1, createContext ×0).
4. CartSessionStore.isExpired correct for valid, past, and fake-timer-advanced contexts.
5. SalesforceCartClient throws CONTEXT_EXPIRED after its TTL passes.
6. Missing x-session-id → 400 MISSING_SESSION on every cart endpoint.
7. Invalid body → 422 VALIDATION with a non-empty details array.
8. Each endpoint: correct status for success, 404, and 503 paths.
