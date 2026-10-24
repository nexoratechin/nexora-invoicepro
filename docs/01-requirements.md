# Stage 1 - Requirements

## Product

Nexora InvoicePro is an invoice and billing system for small Indian businesses, built as a portfolio project for Nexora Technologies.

Tagline: Innovate | Automate | Transform

Two clients, one backend:

- A React web app for desktop and tablet use.
- An Expo React Native app for Android and iOS.

Both talk to one Express API and one MongoDB database. There is no mobile-only data store.

## Who it is for

The primary user runs a service business and sends 5 to 50 invoices a month. They need to raise a GST invoice, share a PDF, record a part payment, and know who still owes them money. They do not need accounting software, inventory, or a payment gateway.

Secondary user is a team member who can create invoices but cannot change business settings or delete records. Team access is modelled from day one but the MVP UI ships for owners only.

## MVP scope

In scope:

1. Register, log in, log out, manage own profile, change password.
2. One business per account, with settings for name, address, logo, GSTIN, invoice prefix, default tax rates, payment terms, and bank details.
3. Customers: create, edit, view, search, soft delete.
4. Products and services: create, edit, activate and deactivate, search.
5. Invoices: draft, edit draft, issue, view, duplicate, void, search and filter.
6. GST calculation with CGST, SGST and IGST, including the tax summary on each invoice.
7. Payments: record full or partial payment, list, void, see balance.
8. Dashboard with counts and revenue for a date range.
9. Reports: revenue by month, outstanding by customer, GST summary.
10. Server-generated PDF with print and download, shared from mobile.
11. Tenant isolation on every business-owned record.

Out of scope for MVP, with a reason:

| Item | Reason |
| --- | --- |
| Payment gateway | Requires merchant onboarding and webhooks. Recorded payments only. |
| Email delivery of invoices | Needs a verified sending domain. PDF download and share instead. |
| Recurring invoices | Large feature, belongs after the core loop is stable. |
| Multi-currency | Adds FX rate storage and reporting rules. INR only. |
| Inventory and stock | Different product. |
| Full accounting, ledgers, TDS | Different product. |
| Offline editing with sync | Needs a conflict-resolution design. Mobile handles offline by showing clear errors and caching reads. |
| Mobile push notifications | Not required for the core loop. |
| Team invite emails | Membership is modelled; invitation flow comes after MVP. |

## Functional requirements

### Accounts and access (FR-A)

- FR-A1: A visitor registers with name, email, password, business name.
- FR-A2: Email must be unique and normalised to lowercase.
- FR-A3: Password needs at least 10 characters and is hashed with argon2id.
- FR-A4: Login returns a short-lived access token and a long-lived refresh token.
- FR-A5: Refresh rotates the token. Reusing an old refresh token revokes the whole token family.
- FR-A6: Logout revokes the current refresh token and clears the cookie.
- FR-A7: A user reads and updates their own name, phone and password.
- FR-A8: Registration creates a business, an owner membership, and default settings in one step.
- FR-A9: Memberships carry a role: owner, admin, staff. Only owner and admin reach settings and delete endpoints.
- FR-A10: Password reset exists only when SMTP settings are present. Otherwise the endpoint returns 503 and the UI hides the link.

### Business settings (FR-S)

- FR-S1: Edit business name, legal name, address, state code, phone, email, website, GSTIN.
- FR-S2: Upload a logo. Accept JPEG, PNG or WebP up to 2 MB. Verify the file signature, not just the extension.
- FR-S3: Set invoice prefix, default payment terms in days, default tax rate, default invoice notes, and bank details.
- FR-S4: Invoice numbering is assigned at issue time, not at draft time, so drafts do not consume numbers.
- FR-S5: Changing the prefix never renumbers an issued invoice.

### Customers (FR-C)

- FR-C1: Create with name (required), email, phone, billing address, shipping address, GSTIN, state code, notes.
- FR-C2: List with pagination, search across name, email, phone, GSTIN, and an active/archived filter.
- FR-C3: Edit any field.
- FR-C4: Archive hides the customer from new invoices. Delete is blocked while non-void invoices exist, and the API returns a 409 explaining why.
- FR-C5: Customer detail shows lifetime billed, lifetime paid, outstanding, and invoice history.

### Products (FR-P)

- FR-P1: Create with name, description, SKU, unit label, unit price, tax rate, active flag.
- FR-P2: SKU is optional and unique per business when present.
- FR-P3: Inactive products stay attached to old invoices but cannot be added to new ones.
- FR-P4: List with search, active filter, pagination.

### Invoices (FR-I)

- FR-I1: Draft holds customer, line items, invoice date, due date, discount, notes, terms, place of supply.
- FR-I2: A line item holds product reference (optional), description, quantity, unit label, unit price, discount, tax rate.
- FR-I3: Adding a product copies its current values into the line. Later product edits do not change issued invoices.
- FR-I4: The server recomputes every amount. Client-submitted totals are ignored.
- FR-I5: Issue assigns the invoice number, stores business and customer snapshots, freezes the content, and records status history.
- FR-I6: Only drafts are editable or deletable.
- FR-I7: Void requires a reason, keeps the invoice visible, and excludes it from revenue but not from the GST report as cancelled.
- FR-I8: Voiding an invoice that has payments requires voiding those payments first.
- FR-I9: Duplicate copies a draft or issued invoice into a new draft with today's dates.
- FR-I10: List filters: status, payment state, customer, date range, search on invoice number and customer name.
- FR-I11: Every invoice records `amountPaidMinor` and `balanceDueMinor`, recalculated whenever a payment changes.

### GST (FR-T)

- FR-T1: Tax rate per line, in basis points, defaulting from product then business settings.
- FR-T2: Place of supply determines treatment. Same state as the business state means CGST plus SGST at half the rate each. Different state means IGST at the full rate.
- FR-T3: The invoice stores the treatment, the rates and the computed amounts per component.
- FR-T4: The invoice shows taxable amount and a tax breakdown by component.
- FR-T5: The app states that tax values are software calculations, not tax advice.

### Payments (FR-PAY)

- FR-PAY1: Record amount, date, method (cash, UPI, bank transfer, cheque, card, other), reference, note.
- FR-PAY2: Partial payments are allowed.
- FR-PAY3: A payment greater than the outstanding balance is rejected with 409.
- FR-PAY4: Payment state is derived: unpaid, partial, paid. Overdue is derived from due date and balance, never stored.
- FR-PAY5: Payments are idempotent per client request ID so a retry after a timeout does not double-charge.
- FR-PAY6: Voiding a payment restores the balance and keeps an audit record.
- FR-PAY7: No payment gateway is implied anywhere in the UI.

### Dashboard and reports (FR-R)

- FR-R1: Dashboard shows total, paid, unpaid and overdue invoice counts, revenue for the selected range, and the 8 most recent invoices.
- FR-R2: Revenue counts issued and paid amounts only, excludes void invoices.
- FR-R3: Reports: monthly revenue, outstanding by customer, GST summary by component and period, top customers.
- FR-R4: All figures come from stored records. Demo data is seeded through a labelled seed script.

### PDF (FR-D)

- FR-D1: The PDF is built from the stored invoice, not from client input.
- FR-D2: It includes business and customer details, number, dates, items, subtotal, discount, tax breakdown, total, paid, balance, bank details, notes, and payment status.
- FR-D3: User text is stripped of control characters and never interpreted as markup or as a path.
- FR-D4: Download and print on web, download and share on mobile.
- FR-D5: A void invoice renders with a VOID watermark.

### Mobile (FR-M)

- FR-M1: Real React Native screens, no WebView.
- FR-M2: Tokens in SecureStore, never in AsyncStorage.
- FR-M3: Keyboard-safe forms, safe areas, pull to refresh, retry on failure.
- FR-M4: Clear network-failure messages and no silent data loss.
- FR-M5: Share the generated PDF from the invoice screen.

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Money | Integers in paise everywhere. No float arithmetic on amounts. |
| Time | Store UTC, render in Asia/Kolkata. Due dates stored as plain dates. |
| Performance | List endpoints respond under 300 ms at 10k invoices on the free Atlas tier. Indexes exist for every list filter. |
| Availability | Single API instance for the portfolio deployment. Health endpoint for the host. |
| Security | argon2id, tenant checks on every query, helmet, rate limits, strict CORS allowlist, 2 MB upload cap, no secrets in client bundles. |
| Privacy | Structured logs carry request ID, user ID, route, status and duration. Never tokens, passwords, or full bodies. |
| Accessibility | Keyboard reachable, labelled inputs, visible focus, 4.5:1 contrast, status conveyed by text and colour. |
| Responsiveness | Web usable from 360 px to 1920 px. Tables become stacked cards below 768 px. |
| Quality | TypeScript strict mode. Shared Zod schemas validate the same shapes on server and clients. |
| Testability | Unit tests for money and tax, API tests for auth, tenant isolation and invoice lifecycle. |

## Money and rounding policy

Amounts are integer paise. `1 INR = 100 paise`. Field names end in `Minor`.

Quantities are integer thousandths, `quantityMilli`, so 1.5 hours is `1500`. Three decimal places covers hours, units and fractional quantities.

Percentages are integer basis points. 18% is `1800`, 2.5% is `250`.

The server computes each line in this order:

1. `grossMinor = roundHalfUp(unitPriceMinor * quantityMilli / 1000)`
2. `discountMinor = roundHalfUp(grossMinor * discountBp / 10000)`, capped at `grossMinor`
3. `taxableMinor = grossMinor - discountMinor`
4. `taxMinor = roundHalfUp(taxableMinor * taxRateBp / 10000)`
5. `lineTotalMinor = taxableMinor + taxMinor`

Then invoice totals are sums of the already-rounded line values: `subtotal`, `discountTotal`, `taxableTotal`, `taxTotal`, `total`. No rounding happens at the invoice level, so the lines always add up to the total.

For the tax split, `cgstMinor = roundHalfUp(taxMinor / 2)` and `sgstMinor = taxMinor - cgstMinor`, so the two halves always recombine to the line tax.

`roundHalfUp` works on integers using quotient and remainder, not on floats.

## Acceptance criteria for the MVP

1. A new user registers, creates a customer and a product, raises a 3-line invoice with 18% GST, and downloads a PDF whose totals match the screen to the paisa.
2. Recording a partial payment moves the invoice to partial, and the dashboard outstanding figure drops by exactly that amount.
3. Paying the balance moves it to paid and the overdue count updates.
4. User B cannot read, edit or guess their way into user A's invoice. All such requests return 404.
5. A user cannot submit a total, a status, or an invoice number that the server does not compute.
6. All API tests and money tests pass, and the test report is reproducible with one command.
7. The web app works at 375 px and at 1440 px.
8. The Expo app builds for Android and completes register, login, create invoice, record payment, share PDF.

## Assumptions to confirm

- Indian GST only, INR only. Foreign currency invoicing is out of scope.
- One business per user for MVP. The data model already allows more.
- Fiscal year numbering runs April to March.
- No email is sent by the system in MVP.
- Deployment targets: API on Render, database on MongoDB Atlas free tier, web on Vercel, Android through EAS Build.
