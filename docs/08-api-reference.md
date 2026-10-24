# Stage 3 - API reference

Everything below is implemented and covered by the server test suite. Base path `/api/v1`.

Amounts are integer paise. Quantities are integer thousandths. Rates are integer basis points. Send `Authorization: Bearer <accessToken>` on every endpoint except the public ones.

## Conventions

Paged list:

```json
{ "items": [], "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request did not pass validation",
    "details": [{ "path": "password", "message": "Use at least 10 characters" }],
    "requestId": "8f2c..."
  }
}
```

Unknown query parameters are rejected with 400. Unknown body fields are rejected with 400. Both are deliberate: a typo should fail loudly.

Codes you may need to branch on: `VALIDATION_FAILED`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `REFRESH_REUSED`, `EMAIL_TAKEN`, `FORBIDDEN_ROLE`, `NOT_FOUND`, `CONFLICT`, `INVOICE_NOT_DRAFT`, `INVOICE_ALREADY_ISSUED`, `INVOICE_HAS_PAYMENTS`, `INSUFFICIENT_BALANCE`, `CUSTOMER_HAS_INVOICES`, `PRODUCT_IN_USE`, `PRODUCT_INACTIVE`, `IDEMPOTENCY_KEY_REQUIRED`, `RATE_LIMITED`, `MAIL_NOT_CONFIGURED`.

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | Liveness. Also at `/api/v1/health`. |
| GET | `/health/db` | Readiness. 503 when MongoDB is down. Also at `/api/v1/health/db`. |
| POST | `/auth/register` | Creates user, business, owner membership, settings. 201. |
| POST | `/auth/login` | 200 with tokens. 401 on bad credentials, 429 when locked. |
| POST | `/auth/refresh` | Rotates. 401 `REFRESH_REUSED` on a replayed token. |
| POST | `/auth/logout` | Revokes the presented refresh token. 204. |
| POST | `/auth/forgot-password` | 503 `MAIL_NOT_CONFIGURED` until SMTP exists. |

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

Response 201:

```json
{
  "user": { "id": "...", "name": "...", "email": "..." },
  "business": { "id": "...", "name": "...", "stateCode": "24", "currency": "INR" },
  "settings": { "invoicePrefix": "NXP", "defaultTaxRateBp": 1800 },
  "role": "owner",
  "accessToken": "...",
  "refreshToken": "..."
}
```

`refreshToken` appears in the body only when the request carries `X-Client-Platform: mobile`. The web client gets an `nx_rt` httpOnly cookie instead and never sees the value.

## Session

| Method | Path | Role |
| --- | --- | --- |
| GET | `/auth/me` | any |
| GET | `/me` | any |
| PATCH | `/me` | any |
| POST | `/auth/change-password` | any |
| POST | `/auth/logout-all` | any |

Changing the password bumps `tokenVersion`, revokes every refresh token, and makes existing access tokens return 401 immediately.

## Business and settings

| Method | Path | Role |
| --- | --- | --- |
| GET | `/business` | any |
| PATCH | `/business` | owner, admin |
| GET | `/settings` | any |
| PUT | `/settings` | owner, admin |

`PUT /settings` accepts `invoicePrefix` (3 to 8 uppercase letters or digits), `numberSeries`, `defaultPaymentTermsDays`, `defaultTaxRateBp`, `defaultNotes`, `paymentInstructions`, `bankDetails`, `taxInclusivePricing`. Prefix changes never renumber an issued invoice.

## Customers

| Method | Path | Role |
| --- | --- | --- |
| GET | `/customers?q&status&page&pageSize&sort` | any |
| POST | `/customers` | any |
| GET | `/customers/:id` | any |
| PATCH | `/customers/:id` | any |
| DELETE | `/customers/:id` | owner, admin |
| POST | `/customers/:id/archive` | any |
| POST | `/customers/:id/restore` | any |

`GET /customers/:id` returns `{ customer, stats }` where stats holds `totalBilledMinor`, `totalPaidMinor`, `outstandingMinor`, `invoiceCount`, `lastInvoiceAt`, all aggregated from invoices.

Delete returns 409 `CUSTOMER_HAS_INVOICES` while any non-void invoice references the customer. Archive instead.

## Products

| Method | Path | Role |
| --- | --- | --- |
| GET | `/products?q&isActive&page&pageSize&sort` | any |
| POST | `/products` | any |
| GET | `/products/:id` | any |
| PATCH | `/products/:id` | any |
| POST | `/products/:id/status` | any |
| DELETE | `/products/:id` | owner, admin |

`taxRateBp` must be a GST slab: 0, 500, 1200, 1800, 2800. `sku` is unique per business and optional. Delete returns 409 `PRODUCT_IN_USE` when the product appears on any invoice.

## Invoices

| Method | Path | Role |
| --- | --- | --- |
| GET | `/invoices?q&status&paymentState&overdue&customerId&from&to&page&pageSize&sort` | any |
| POST | `/invoices` | any |
| GET | `/invoices/:id` | any |
| PATCH | `/invoices/:id` | any, draft only |
| DELETE | `/invoices/:id` | owner, admin |
| POST | `/invoices/:id/issue` | any |
| POST | `/invoices/:id/void` | owner, admin |
| POST | `/invoices/:id/duplicate` | any |
| GET | `/invoices/:id/events` | any |
| GET | `/invoices/:id/payments` | any |
| POST | `/invoices/:id/payments` | any |

Create:

```json
{
  "customerId": "68f1c0...",
  "invoiceDate": "2026-10-24",
  "dueDate": "2026-11-08",
  "placeOfSupplyStateCode": "27",
  "notes": "",
  "terms": "",
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
    }
  ]
}
```

Response includes `totals` with `subtotalMinor`, `discountTotalMinor`, `taxableTotalMinor`, `cgstTotalMinor`, `sgstTotalMinor`, `igstTotalMinor`, `taxTotalMinor`, `roundOffMinor`, `totalMinor`, plus `amountPaidMinor`, `balanceDueMinor` and a computed `overdue` flag.

Rules worth knowing:

- Sending `totals`, `status` or `invoiceNumber` is a 400, not a silent correction.
- A draft has `invoiceNumber: null`. The number is assigned at issue.
- `taxTreatment` is `intra` when the place of supply matches the business state, otherwise `inter`.
- Inactive products are refused with `PRODUCT_INACTIVE`.
- `dueDate` before `invoiceDate` is a 400.
- `PATCH` recomputes every total from the submitted lines.
- `DELETE` only removes drafts. Void an issued invoice instead.
- `void` needs `{ "reason": "..." }`, refuses an invoice with active payments, and keeps the invoice in the list.
- `duplicate` copies into a new draft with today's date and the settings payment terms.

List items include a computed `overdue` boolean. `overdue=true` filters to issued invoices with a balance past the due date.

### PDF

`GET /invoices/:id/pdf` returns the invoice as an attachment, `Content-Disposition: attachment; filename="NXP-2026-27-0007.pdf"`.

- Built from the stored document, including the customer and business snapshots.
- Integers are formatted in Indian grouping, and the rupee glyph comes from an embedded Noto Sans.
- A draft or void invoice prints a watermark.
- Long invoices paginate, repeating the table header.
- 30 downloads per 5 minutes per IP, then 429.
- Another business's invoice returns 404, same as every other invoice route.
## Payments

| Method | Path | Role |
| --- | --- | --- |
| GET | `/payments?invoiceId&customerId&method&status&from&to&q&page&pageSize` | any |
| GET | `/payments/:id` | any |
| POST | `/payments/:id/void` | owner, admin |

Record a payment through `POST /invoices/:id/payments` with a required `Idempotency-Key` header of at least 8 characters:

```json
{
  "amountMinor": 1000000,
  "paidAt": "2026-10-24",
  "method": "upi",
  "reference": "UPI/4123/8891",
  "note": "Advance"
}
```

- 201 the first time, 200 when the same key is replayed, always the same payment.
- 409 `INSUFFICIENT_BALANCE` with `details.balanceDueMinor` when the amount exceeds what is owed.
- Concurrency is handled by one conditional `$inc` on the invoice guarded by `balanceDueMinor >= amount`. If the guard fails, the payment row is removed and the call returns 409.
- Voiding a payment restores the balance and moves the state back to `partial` or `unpaid`.

## Reports

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dashboard?from&to` | counts, revenue, recent and overdue invoices. Defaults to the current month. |
| GET | `/reports/summary?from&to` | billed, collected, outstanding, taxable value, tax, average invoice |
| GET | `/reports/revenue?from&to&groupBy=month` | monthly series |
| GET | `/reports/outstanding?asOf` | aging buckets 0-15, 16-30, 31-60, 60+ |
| GET | `/reports/gst?from&to` | taxable value and CGST, SGST, IGST per rate |
| GET | `/reports/top-customers?from&to&limit` | ranked by billed value |

Void and draft invoices never count as revenue. `counts.total` is issued invoices only, and `counts.draft` and `counts.void` are reported separately so the two numbers cannot be confused.

## Rate limits

| Scope | Limit |
| --- | --- |
| Every `/api/v1` route | 300 per minute per IP |
| Login | 10 per 15 minutes per IP, plus 5 failed passwords per email locks that email for 15 minutes |
| Register | 5 per hour per IP |
| Forgot password | 5 per hour per IP |

Limits are skipped when `NODE_ENV=test` so the suite can run. They live in process memory, so a multi instance deployment needs a shared store.

## OpenAPI

`GET /api/openapi.json` returns the document. `GET /api/docs` serves Swagger UI. The UI page drops the strict CSP because Swagger injects inline scripts; the rest of the API keeps it.
