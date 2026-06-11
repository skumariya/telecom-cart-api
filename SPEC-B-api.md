# SPEC-B: API Endpoint Contracts

> **Audience**: Claude Code (or any AI coding assistant).
> Paste this file verbatim together with SPEC-A-architecture.md into the implementation prompt.

---

## Base Path

```
/api/v1
```

## Scope Note

Cart **creation** is intentionally out of scope. Carts are owned by Salesforce and their
cartIds already exist; this Experience API manages the ephemeral context and line items
on top of an existing cart. The test double pre-seeds `cart-001` and `cart-002`.

---

## Common Request Headers

| Header | Required on | Behaviour when missing |
|--------|-------------|------------------------|
| `x-session-id` | All `/carts/**` endpoints | `400 MISSING_SESSION` |
| `Content-Type: application/json` | POST, PATCH | body parse fails |

## Common Error Response

```json
{
  "error":   "Human-readable message",
  "code":    "MACHINE_CODE",
  "details": ["per-field message"]
}
```

`details` appears **only** on `422 VALIDATION` responses.

## Status → Code Map

| Status | Code | Trigger |
|--------|------|---------|
| 400 | `MISSING_SESSION` | header absent |
| 400 | `VALIDATION` | Salesforce-side validation failure |
| 422 | `VALIDATION` | DTO (request body) validation failure |
| 404 | `NOT_FOUND` | unknown cartId or itemId |
| 503 | `CONTEXT_EXPIRED` | context renewal failed even after retry |
| 500 | `INTERNAL` | unexpected error |

---

## Endpoints

### 1 · GET /api/v1/health

No headers. Liveness probe.

**200**
```json
{ "status": "ok", "timestamp": "2024-01-15T10:30:00.000Z" }
```

---

### 2 · GET /api/v1/carts/:cartId

Returns the full cart. Creates a Salesforce context transparently on first call for a
session; renews transparently (single retry) if expired.

**Headers**: `x-session-id`

**200**
```json
{
  "cartId": "cart-001",
  "items": [
    {
      "itemId": "550e8400-e29b-41d4-a716-446655440000",
      "productId": "prod-001",
      "productName": "Unlimited Plan",
      "quantity": 2,
      "unitPrice": 49.99,
      "totalPrice": 99.98
    }
  ],
  "totalAmount": 99.98,
  "currency": "USD"
}
```

**Errors**: 400 `MISSING_SESSION` · 404 `NOT_FOUND` · 503 `CONTEXT_EXPIRED`

---

### 3 · POST /api/v1/carts/:cartId/items

**Headers**: `x-session-id`, `Content-Type: application/json`

**Body**
```json
{
  "productId": "prod-001",
  "productName": "Unlimited Plan",
  "quantity": 1,
  "unitPrice": 49.99
}
```

**Validation (AddItemDto)**

| Field | Rule |
|-------|------|
| productId | string, non-empty |
| productName | string, non-empty |
| quantity | integer ≥ 1 |
| unitPrice | number ≥ 0 (free items allowed) |

**201** — returns the created `CartItem` (itemId is a server-generated UUID).

**Errors**: 400 `MISSING_SESSION` · 422 `VALIDATION` · 404 `NOT_FOUND` · 503 `CONTEXT_EXPIRED`

---

### 4 · PATCH /api/v1/carts/:cartId/items/:itemId

**Headers**: `x-session-id`, `Content-Type: application/json`

**Body**
```json
{ "quantity": 3 }
```

**Validation (UpdateItemQtyDto)**: `quantity` integer ≥ 1.

**200** — returns the updated `CartItem` with recalculated `totalPrice`.

**Errors**: 400 `MISSING_SESSION` · 422 `VALIDATION` · 404 `NOT_FOUND` · 503 `CONTEXT_EXPIRED`

---

### 5 · DELETE /api/v1/carts/:cartId/items/:itemId

**Headers**: `x-session-id`

**204** — empty body.

**Errors**: 400 `MISSING_SESSION` · 404 `NOT_FOUND` · 503 `CONTEXT_EXPIRED`

---

## curl Quick Reference

```bash
BASE="http://localhost:3000/api/v1"
SESSION="my-session"
CART="cart-001"

curl $BASE/health

curl -H "x-session-id: $SESSION" $BASE/carts/$CART

curl -X POST $BASE/carts/$CART/items \
  -H "x-session-id: $SESSION" -H "Content-Type: application/json" \
  -d '{"productId":"prod-001","productName":"Unlimited Plan","quantity":1,"unitPrice":49.99}'

curl -X PATCH $BASE/carts/$CART/items/<itemId> \
  -H "x-session-id: $SESSION" -H "Content-Type: application/json" \
  -d '{"quantity":3}'

curl -X DELETE $BASE/carts/$CART/items/<itemId> \
  -H "x-session-id: $SESSION"
```
