# Telecom Cart Experience API

A thin **Experience API** that powers a telecom cart on top of a non-persistent
Salesforce cart context. The Salesforce context expires every 30 seconds; this API
renews it transparently so callers never see expiry errors.

| Concern | Choice |
|---------|--------|
| Language | TypeScript 5 / Node 20 |
| HTTP framework | Express 4 |
| Dependency Injection | Inversify 6 (Symbol tokens, Singleton scope) |
| Request validation | class-validator + class-transformer DTOs |
| Testing | Jest 29 + ts-jest + Supertest |

---

## Quick Start

```bash
npm install
npm run dev          # ts-node-dev with hot-reload on :3000
```

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok","timestamp":"..."}
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot-reload |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled build |
| `npm test` | Run all 59 tests (5 suites) |
| `npm run test:watchAll` | Watch mode |
| `npm run test:coverage` | Coverage report (text + lcov) |
| `npm run lint` | Type-check without emit |

Override the port: `PORT=8080 npm run dev`.

---

## API Reference

Base: `http://localhost:3000/api/v1` · Pre-seeded carts: **`cart-001`**, **`cart-002`**

All `/carts/**` endpoints require the **`x-session-id`** header (missing → 400 `MISSING_SESSION`).

> Cart **creation** is intentionally not exposed: carts are owned by Salesforce and their
> IDs already exist. This API manages the ephemeral context + line items on top.

### Endpoints

| Method | Path | Success | Notes |
|--------|------|---------|-------|
| GET | `/health` | 200 | liveness probe, no headers |
| GET | `/carts/:cartId` | 200 `Cart` | auto-creates / renews context |
| POST | `/carts/:cartId/items` | 201 `CartItem` | body validated by `AddItemDto` |
| PATCH | `/carts/:cartId/items/:itemId` | 200 `CartItem` | body validated by `UpdateItemQtyDto` |
| DELETE | `/carts/:cartId/items/:itemId` | 204 | empty body |

### Request body — add item

```json
{
  "productId": "prod-001",
  "productName": "Unlimited Plan",
  "quantity": 1,
  "unitPrice": 49.99
}
```

Rules: `productId`/`productName` non-empty strings · `quantity` integer ≥ 1 ·
`unitPrice` number ≥ 0.

### Request body — update quantity

```json
{ "quantity": 3 }
```

### Error response shape

```json
{
  "error": "Request validation failed",
  "code": "VALIDATION",
  "details": ["quantity must be at least 1"]
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `MISSING_SESSION` | `x-session-id` absent |
| 422 | `VALIDATION` | request body fails DTO rules (`details` included) |
| 404 | `NOT_FOUND` | unknown cartId / itemId |
| 503 | `CONTEXT_EXPIRED` | context renewal failed even after the retry |
| 500 | `INTERNAL` | unexpected error |

### curl walk-through

```bash
SESSION="my-session"

# Add an item (note the returned itemId)
curl -X POST http://localhost:3000/api/v1/carts/cart-001/items \
  -H "x-session-id: $SESSION" -H "Content-Type: application/json" \
  -d '{"productId":"prod-001","productName":"Unlimited Plan","quantity":2,"unitPrice":49.99}'

# View the cart
curl -H "x-session-id: $SESSION" http://localhost:3000/api/v1/carts/cart-001

# Change quantity
curl -X PATCH http://localhost:3000/api/v1/carts/cart-001/items/<itemId> \
  -H "x-session-id: $SESSION" -H "Content-Type: application/json" \
  -d '{"quantity":5}'

# Remove
curl -X DELETE http://localhost:3000/api/v1/carts/cart-001/items/<itemId> \
  -H "x-session-id: $SESSION"
```

---

## Project Structure

```
src/
├── config/
│   ├── inversify.config.ts     # DI container factory
│   └── routes.config.ts        # Controller → Express Router wiring
├── constants/
│   ├── http-status.ts
│   └── symbols.ts              # Inversify Symbol tokens (TYPES)
├── controllers/
│   └── cart.controller.ts      # Thin handlers — session check, DTO validation, delegate
├── dtos/
│   ├── add-item.dto.ts
│   └── update-item-qty.dto.ts
├── errors/
│   └── app.errors.ts           # SalesforceError · ValidationError · MissingSessionError
├── interfaces/
│   ├── cart-service.interface.ts
│   └── salesforce-cart-client.interface.ts
├── middlewares/
│   └── error-handler.middleware.ts
├── modules/
│   ├── cart/
│   │   ├── cart-session-store.ts   # sessionId → CartContext map
│   │   └── cart.service.ts         # orchestration + single retry on expiry
│   └── salesforce/
│       └── salesforce-cart-client.ts  # in-memory test double, 30 s context TTL
├── types/
│   └── cart.types.ts
├── utils/
│   └── validate.ts             # class-validator helper
├── app.ts                      # createApp(container?) factory
└── main.ts
tests/
├── unit/                       # direct instantiation + jest.fn() mocks
└── integration/                # isolated DI container + Supertest
```

---

## Architecture Decisions

**Transparent context renewal.** `CartService.withRetry` wraps every Salesforce call.
On `CONTEXT_EXPIRED` it deletes the stale session entry, creates one fresh context,
updates the store, and retries the operation exactly once. A second failure propagates —
the retry never loops.

**Inversify zero-primitive rule.** Every container-bound class has either a zero-arg
constructor or fully `@inject`-tokened parameters, because Inversify cannot resolve
primitives. Test-time configuration for the client goes through a static factory —
`SalesforceCartClient.create({ ttlMs: 100, simulateLatency: false })` — which keeps the
DI graph clean while keeping tests fast and deterministic.

**Interface-first client contract.** `ISalesforceCartClient` decouples the service layer
from the implementation. The DI container binds the test double today; binding a real
Salesforce SDK adapter later changes one line in `inversify.config.ts` and nothing else.

**class-validator DTOs.** Request bodies are transformed via `plainToInstance` and
validated against decorator constraints in one reusable helper (`validateDto`). Failures
return 422 with per-field messages in `details`, so frontend forms can map errors to
inputs directly.

**App factory + injectable container.** `createApp(container?)` lets integration tests
build an isolated container with `toConstantValue(mockClient)` per suite — no shared
state, no module mocking.

---

## Test Coverage Summary

```
Test Suites: 4 passed · Tests: 40 passed
```

| Suite | What it proves |
|-------|----------------|
| `cart-session-store.test.ts` | set/get/delete/overwrite · `isExpired` under real and fake timers |
| `cart.service.test.ts` | single retry on expiry (createContext ×1, op ×2, store refreshed) · retry-failure propagation · no retry on other errors |
| `salesforce-cart-client.test.ts` | TTL enforcement throws `CONTEXT_EXPIRED` · totals math · NOT_FOUND / VALIDATION paths |
| `validate.test.ts` | every DTO constraint, positive and negative, including `details` content |

---

## Tradeoffs & Known Gaps

| Item | Current | Production upgrade |
|------|---------|--------------------|
| Session store | In-memory, process-scoped | Redis / Cloud Memorystore for horizontal scale |
| Cart data | Pre-seeded in test double | Real Salesforce WebCart API adapter |
| Auth | None | JWT validation middleware before cart routes |
| Logging | Startup `console.log` only | pino + request-id correlation |
| Context TTL | Fixed 30 s constant | Honour Salesforce's returned `expiresAt` |
| Graceful shutdown | None | SIGTERM drain of in-flight requests |
