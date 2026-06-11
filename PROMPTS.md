# PROMPTS.md — Claude Code Prompt Log

> Exact prompts given to Claude Code to produce this codebase, with notes on what was
> accepted or edited. To regenerate the project, paste the prompts in order.

---

## Prompt 1 — Full Source Implementation

```
You are implementing a Telecom Cart Experience API. Read both specs and implement the
full solution in TypeScript / Node 20.

============================================================
[PASTE FULL CONTENTS OF SPEC-A-architecture.md HERE]
============================================================
[PASTE FULL CONTENTS OF SPEC-B-api.md HERE]
============================================================

Stack and constraints:
- Express 4 with Inversify 6 dependency injection (constructor injection,
  @injectable / @inject with Symbol tokens).
- class-validator + class-transformer for request body validation via DTO classes.
- No database, no real Salesforce calls — implement SalesforceCartClient as an
  in-memory test double with realistic context expiry (30 s TTL).
- jest + ts-jest + supertest for tests (written in a later prompt).

Implementation order (dependencies first):
  src/types/cart.types.ts
  src/errors/app.errors.ts
  src/constants/symbols.ts
  src/constants/http-status.ts
  src/interfaces/salesforce-cart-client.interface.ts
  src/interfaces/cart-service.interface.ts
  src/modules/salesforce/salesforce-cart-client.ts
  src/modules/cart/cart-session-store.ts
  src/modules/cart/cart.service.ts
  src/dtos/add-item.dto.ts
  src/dtos/update-item-qty.dto.ts
  src/utils/validate.ts
  src/controllers/cart.controller.ts
  src/middlewares/error-handler.middleware.ts
  src/config/inversify.config.ts
  src/config/routes.config.ts
  src/app.ts
  src/main.ts

Non-negotiable design rules (from SPEC-A):
1. Every class registered in the Inversify container must have either a zero-arg
   constructor or a constructor whose every parameter is @inject-ed with a Symbol
   token. Inversify cannot resolve primitive types (number, boolean, string) —
   SalesforceCartClient therefore uses a zero-arg constructor with production
   defaults, plus a static factory `SalesforceCartClient.create(opts)` for tests.
2. import 'reflect-metadata' must be the first import in every file that uses
   Inversify decorators, and in app.ts and main.ts.
3. All custom error classes call Object.setPrototypeOf(this, <Class>.prototype)
   so instanceof checks work under ts-jest.
4. tsconfig: module commonjs, experimentalDecorators + emitDecoratorMetadata true.
5. jest.config.js configures ts-jest inside the transform block (the modern format),
   never under globals.
6. CartService implements single-retry-on-CONTEXT_EXPIRED: renew context once,
   retry the operation once, propagate any second failure. Never loop.
```

**Outcome:** All 18 source files generated. Accepted with two small edits:
- Tightened the static factory cast to `as unknown as {...}` to satisfy strict mode.
- Added `details` array to the 422 validation response shape.

---

## Prompt 2 — Unit & Integration Tests

```
Write the full test suite. Unit tests in tests/unit/, integration tests in
tests/integration/.

Files:
  tests/unit/cart-session-store.test.ts
  tests/unit/cart.service.test.ts
  tests/unit/salesforce-cart-client.test.ts
  tests/unit/validate.test.ts
  tests/integration/cart.routes.test.ts

Rules:
1. import 'reflect-metadata' first line of every test file.
2. Unit tests bypass Inversify — instantiate classes directly with `new`,
   pass jest.fn()-based jest.Mocked<ISalesforceCartClient> mocks.
3. SalesforceCartClient tests use the static factory only:
   SalesforceCartClient.create({ ttlMs: 100, simulateLatency: false }).
4. Integration tests build one isolated Container per suite:
   bind TYPES.SalesforceCartClient with .toConstantValue(mockClient),
   real bindings for store/service/controller, then createApp(container) + supertest.
5. Expiry tests use jest.useFakeTimers() with afterEach(() => jest.useRealTimers()).

Critical paths that must be covered:
  1. CartService retries exactly once on CONTEXT_EXPIRED and succeeds
     (assert createContext called once, operation called twice, store updated).
  2. CartService propagates the error when the retry also fails
     (assert exactly two operation calls — never more).
  3. CartService does NOT retry non-expiry errors.
  4. CartSessionStore.isExpired correct with real time and fake-timer advance.
  5. SalesforceCartClient throws CONTEXT_EXPIRED after TTL passes.
  6. Missing x-session-id → 400 MISSING_SESSION on every cart endpoint.
  7. Invalid body → 422 VALIDATION with a non-empty details array.
  8. Each endpoint returns the right status for success / 404 / 503 cases.
```

**Outcome:** 5 suites, 59 tests, all passing. Accepted as-is.

---

## Prompt 3 — Documentation

```
Write README.md covering: prerequisites, install/run/test commands, full API
reference (all 5 endpoints with request/response shapes, validation rules, and
error tables), the project folder tree, architecture decisions (DI design,
withRetry pattern, interface-first client contract, class-validator DTOs),
and a tradeoffs/known-gaps table. Keep SPEC-A, SPEC-B, and this PROMPTS.md
unchanged.
```

**Outcome:** Accepted with minor wording edits.

---

## Verification

```bash
npm install
npm test        # Test Suites: 5 passed — Tests: 59 passed
npm run lint    # tsc --noEmit, clean
npm run dev     # boots on :3000; /api/v1/health returns { status: "ok" }
```
