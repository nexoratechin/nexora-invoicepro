# Stage 1 - API plan

## Conventions

Base path: `/api/v1`

Auth header: `Authorization: Bearer <accessToken>`

List response:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0,
  "totalPages": 0
}
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request body is invalid",
    "details": [{ "path": "items.0.quantityMilli", "message": "Must be a positive integer" }],
    "requestId": "01JE8W3K9Q"
  }
}
```

Status codes used: 200 OK, 201 Created, 204 No Content, 400 malformed, 401 unauthenticated, 403 wrong role, 404 not found or not yours, 409 state conflict, 422 business rule violation with details, 429 rate limited, 500 unexpected.

Machine error codes the clients branch on: `VALIDATION_FAILED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `REFRESH_REUSED`, `EMAIL_TAKEN`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `INVOICE_NOT_DRAFT`, `INVOICE_ALREADY_ISSUED`, `INVOICE_HAS_PAYMENTS`, `INSUFFICIENT_BALANCE`, `CUSTOMER_HAS_INVOICES`, `PRODUCT_INACTIVE`, `UPLOAD_INVALID_TYPE`, `UPLOAD_TOO_LARGE`, `RATE_LIMITED`, `MAIL_NOT_CONFIGURED`.

## Auth

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/auth/register` | Create user, business, owner membership, default settings | public |
| POST | `/auth/login` | Email and password to tokens | public |
| POST | `/auth/refresh` | Rotate refresh token, return new access token | refresh token |
| POST | `/auth/logout` | Revoke current refresh token | refresh token |
| POST | `/auth/logout-all` | Revoke every session for the user | bearer |
| GET | `/auth/me` | Current user, business, membership, unread setup state | bearer |
| POST | `/auth/forgot-password` | Send reset link when SMTP is configured | public, 5/hour |
| POST | `/auth/reset-password` | Consume reset token, set new password, revoke sessions | public |

`POST /auth/register`

```json
{
  "name": "Parth Prajapati",
  "email": "parth@nexoratechnologies.in",
  "password": "a-long-password",
  "businessName": "Nexora Technologies",
  "stateCode": "24"
}
```

Returns 201 with `{ user, business, accessToken, refreshToken? }`. `refreshToken` appears in the body only when the header `X-Client-Platform: mobile` is present. The web client gets an httpOnly cookie instead.

`POST /auth/login` takes `{ email, password }`. Same response shape.

`POST /auth/refresh` with `X-Client-Platform: mobile` takes `{ refreshToken }` in the body. Without that header it reads the cookie.

## Profile

| Method | Path | Purpose | Role |
| --- | --- | --- | --- |
| GET | `/me` | Own profile | any |
| PATCH | `/me` | Update name and phone | any |
| POST | `/me/password` | Change password, revoke other sessions | any |

## Business and settings

| Method | Path | Purpose | Role |
| --- | --- | --- | --- |
| GET | `/business` | Business profile | any |
| PATCH | `/business` | Update name, legal name, GSTIN, address, contact | owner, admin |
| GET | `/settings` | Invoice and tax defaults, bank details | any |
| PUT | `/settings` | Replace settings | owner, admin |
| POST | `/settings/logo` | Multipart logo upload | owner, admin |
| DELETE | `/settings/logo` | Remove logo | owner, admin |
| GET | `/business/members` | Team list | owner, admin |
| POST | `/business/members` | Add member by email | owner |

## Customers

| Method | Path | Purpose | Role |
| --- | --- | --- | --- |
| GET | `/customers` | List with search, filter, pagination | any |
| POST | `/customers` | Create | any |
| GET | `/customers/:id` | Detail plus billing stats | any |
| PATCH | `/customers/:id` | Update | any |
| DELETE | `/customers/:id` | Delete when no non-void invoices exist | owner, admin |
| POST | `/customers/:id/archive` | Archive | any |
| POST | `/customers/:id/restore` | Restore to active | any |

`GET /customers?q=acme&status=active&page=1&pageSize=20&sort=name`

Detail response includes `stats: { totalBilledMinor, totalPaidMinor, outstandingMinor, invoiceCount, lastInvoiceAt }` computed from invoices, not stored on the customer.

## Products

| Method | Path | Purpose | Role |
| --- | --- | --- | --- |
| GET | `/products` | List with search, active filter, pagination | any |
| POST | `/products` | Create | any |
| GET | `/products/:id` | Detail | any |
| PATCH | `/products/:id` | Update | any |
| DELETE | `/products/:id` | Delete when unused by any invoice | owner, admin |
| POST | `/products/:id/status` | Activate or deactivate | any |

## Invoices

| Method | Path | Purpose | Role |
| --- | --- | --- | --- |
| GET | `/invoices` | List with filters | any |
| POST | `/invoices` | Create draft | any |
| GET | `/invoices/:id` | Detail | any |
| PATCH | `/invoices/:id` | Update draft only | any |
| DELETE | `/invoices/:id` | Delete draft only | owner, admin |
| POST | `/invoices/:id/issue` | Assign number, freeze, issue | any |
| POST | `/invoices/:id/void` | Void with reason | owner, admin |
| POST | `/invoices/:id/duplicate` | Copy into a new draft | any |
| GET | `/invoices/:id/pdf` | Stream PDF | any |
| GET | `/invoices/:id/events` | History | any |
| GET | `/invoices/:id/payments` | Payments for the invoice | any |
| POST | `/invoices/:id/payments` | Record payment | any |

Filters on `GET /invoices`: `q`, `status` (`draft`, `issued`, `void`), `paymentState` (`unpaid`, `partial`, `paid`), `overdue` (`true`), `customerId`, `from`, `to`, `sort`, `page`, `pageSize`.

`POST /invoices` body:

```json
{
  "customerId": "68f1c0...",
  "invoiceDate": "2026-10-24",
  "dueDate": "2026-11-08",
  "placeOfSupplyStateCode": "27",
  "notes": "Thanks for the work.",
  "terms": "Payment within 15 days.",
  "lineItems": [
    {
      "productId": "68f1c1...",
      "description": "Website redesign, 5 pages",
      "hsnSac": "998314",
      "unitLabel": "project",
      "quantityMilli": 1000,
      "unitPriceMinor": 2500000,
      "discountBp": 0,
      "taxRateBp": 1800
    },
    {
      "description": "Hosting, 12 months",
      "unitLabel": "month",
      "quantityMilli": 12000,
      "unitPriceMinor": 50000,
      "discountBp": 500,
      "taxRateBp": 1800
    }
  ]
}
```

The server ignores any `totals`, `status`, `invoiceNumber`, `amountPaidMinor` or `balanceDueMinor` in the body. They are stripped by the schema, and the response returns what the server calculated. A test posts a fake `totals.totalMinor` of 1 and asserts it is ignored.

`POST /invoices/:id/issue` takes `{}` and returns the issued invoice with `invoiceNumber` and `issuedAt`. 409 `INVOICE_ALREADY_ISSUED` if called twice.

`POST /invoices/:id/void` takes `{ "reason": "Raised against the wrong customer" }`. 409 `INVOICE_HAS_PAYMENTS` when active payments exist.

## Payments

| Method | Path | Purpose | Role |
| --- | --- | --- | --- |
| GET | `/payments` | List all payments, filters `from`, `to`, `method`, `customerId`, `invoiceId` | any |
| GET | `/payments/:id` | Detail | any |
| POST | `/payments/:id/void` | Void a payment with reason | owner, admin |

`POST /invoices/:id/payments` body:

```json
{
  "amountMinor": 1000000,
  "paidAt": "2026-10-24",
  "method": "upi",
  "reference": "UPI/4123/8891",
  "note": "Advance"
}
```

Header `Idempotency-Key: 6f2a...` is required. Replaying the same key returns the original payment with 200 instead of creating a second one. A new key with an amount above the balance returns 409 `INSUFFICIENT_BALANCE` and includes `details: { balanceDueMinor }` so the client can correct the form.

## Dashboard and reports

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dashboard?from&to` | Counts, revenue, recent invoices, top overdue |
| GET | `/reports/summary?from&to` | Revenue, collected, outstanding, tax collected |
| GET | `/reports/revenue?from&to&groupBy=month` | Revenue series |
| GET | `/reports/outstanding?asOf` | Aged buckets: 0-15, 16-30, 31-60, 60+ |
| GET | `/reports/gst?from&to` | Taxable value and CGST, SGST, IGST split |
| GET | `/reports/top-customers?from&to&limit=5` | Customers by billed value |

Dashboard response:

```json
{
  "range": { "from": "2026-10-01", "to": "2026-10-31" },
  "counts": {
    "total": 24, "paid": 11, "unpaid": 6, "partial": 4,
    "overdue": 3, "draft": 2, "void": 1
  },
  "revenue": {
    "billedMinor": 84500000,
    "collectedMinor": 51200000,
    "outstandingMinor": 33300000,
    "overdueMinor": 9400000
  },
  "recentInvoices": [],
  "overdueInvoices": []
}
```

`counts.total` excludes void. Revenue excludes draft and void. These rules live in one reporting service so the dashboard and the reports cannot drift apart.

## Health and docs

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness, returns uptime and version, no auth, outside `/api/v1` rate limit |
| GET | `/api/v1/health/db` | Database ping, 200 or 503 |
| GET | `/api/docs` | Swagger UI |
| GET | `/api/openapi.json` | OpenAPI 3.1 document |

## Rate limits

| Scope | Limit |
| --- | --- |
| Global per IP | 300 requests per minute |
| `POST /auth/login` | 10 per 15 minutes per IP, plus 5 failures per email before a 15 minute lock |
| `POST /auth/register` | 5 per hour per IP |
| `POST /auth/forgot-password` | 5 per hour per IP |
| `POST /invoices/:id/pdf` | 30 per 5 minutes per user |
| Uploads | 20 per hour per business |

Limits are in memory by default. The README notes that a multi-instance deployment needs a shared store, and a Redis-backed limiter is out of MVP scope.
