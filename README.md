# Nexora InvoicePro

Invoice and billing system for small Indian businesses. GST invoices, customers, products, payments, reports and a server-generated PDF, on web and on mobile, against one API and one database.

Built by [Nexora Technologies](https://github.com/nexoratechin). Innovate | Automate | Transform.

## Status

Stage 7 of 9 is complete. The app is feature complete and the sweep is written up in [docs/09-test-report.md](docs/09-test-report.md). Deployment is next.

Working today:

- Authentication with argon2id, short lived access tokens, rotating refresh tokens, reuse detection and revoke-all on password change.
- Business, settings, customers, products, invoices and payments through a REST API.
- Server computed GST with integer paise, CGST/SGST/IGST split, and totals that reconcile to the line.
- Invoice lifecycle: draft, issue with concurrency safe numbering, duplicate, void with an audit trail.
- Payments with idempotency, partial payments, balance guards and void.
- Dashboard and five reports built from stored records.
- A React web app covering every screen: sign in, register, dashboard, customers, products, invoice editor with live totals, invoice detail with payments and history, reports, settings, not found.
- An Expo React Native app with tab navigation, secure token storage, and the invoice loop on a phone.
- A server rendered PDF invoice with the tax breakdown, amount in words, bank details, a void watermark and page numbers. Downloaded on web, shared from mobile.
- OpenAPI 3.1 document and Swagger UI.
- A seed script that creates a labelled demo business.

Not built yet: deployment, the accessibility and security sweep, and a device test of the mobile build. Those are Stages 7 and 8.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/01-requirements.md](docs/01-requirements.md) | MVP scope, requirements, money and rounding policy |
| [docs/02-user-flows.md](docs/02-user-flows.md) | Actors, use case diagram, end-to-end flows |
| [docs/03-architecture.md](docs/03-architecture.md) | System, deployment, request lifecycle, auth design, tenancy rules |
| [docs/04-database-design.md](docs/04-database-design.md) | ER diagram, collections, indexes, snapshot strategy |
| [docs/05-api-plan.md](docs/05-api-plan.md) | Endpoints, payloads, error codes, rate limits |
| [docs/06-screens.md](docs/06-screens.md) | Web and mobile routes, components, brand tokens |
| [docs/07-roadmap.md](docs/07-roadmap.md) | Nine stages with estimates |
| [docs/08-api-reference.md](docs/08-api-reference.md) | Every endpoint as implemented, with example calls |
| [docs/09-test-report.md](docs/09-test-report.md) | What was tested, what passed, what was not run, and the measured numbers |

## Getting started

Requirements: Node.js 22.13 or newer, npm 11 or newer, Git, and MongoDB (Atlas or a local install).

```bash
npm install
cp server/.env.example server/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

On PowerShell use `Copy-Item server/.env.example server/.env` for each file.

Edit `server/.env`:

1. Set `MONGODB_URI`. A local server is `mongodb://127.0.0.1:27017/nexora_invoicepro`; Atlas gives you a `mongodb+srv://` string with the database name at the end.
2. Generate the two secrets and paste them in:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The API refuses to start without both secrets, because starting with a default secret is worse than not starting.

Then:

```bash
npm run seed     # optional demo data
npm run dev
```

- API on http://localhost:4000
- Swagger UI on http://localhost:4000/api/docs
- OpenAPI JSON on http://localhost:4000/api/openapi.json
- Web on http://localhost:5173

### Demo account

After `npm run seed`:

```
email:    demo@nexora.test
password: nexora-demo-password
```

The seed creates Nexora Technologies in Gujarat, six customers across four states, eight products across four GST slabs, and twelve invoices covering paid, part paid, unpaid, overdue, draft and void. It refuses to run when `NODE_ENV=production` and refuses to overwrite an existing demo user.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API and web together |
| `npm run dev:api` | API with reload |
| `npm run dev:web` | Web app |
| `npm run dev:mobile` | Expo dev server |
| `npm run seed` | Create demo data |
| `npm run typecheck` | TypeScript across every workspace |
| `npm run lint` | ESLint with type-aware rules |
| `npm run format` | Prettier write |
| `npm test` | Vitest everywhere |
| `npm run build` | Production build of shared, server and web |

## API in one screen

Base path `/api/v1`. Amounts are integer paise. Every business record is scoped to the business inside the access token.

```bash
# Register, mobile style so the refresh token comes back in the body
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" -H "X-Client-Platform: mobile" \
  -d '{"name":"Demo Owner","email":"demo2@nexora.test","password":"correct-horse-battery","businessName":"Demo Studio","stateCode":"24"}'

# Everything else uses the access token
curl http://localhost:4000/api/v1/customers -H "Authorization: Bearer $TOKEN"

# Raise and issue an invoice
curl -X POST http://localhost:4000/api/v1/invoices -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"...","invoiceDate":"2026-10-24","dueDate":"2026-11-08","lineItems":[{"description":"Website redesign","quantityMilli":1000,"unitPriceMinor":2500000,"taxRateBp":1800}]}'

curl -X POST http://localhost:4000/api/v1/invoices/INVOICE_ID/issue -H "Authorization: Bearer $TOKEN"

# Record a part payment, idempotently
curl -X POST http://localhost:4000/api/v1/invoices/INVOICE_ID/payments \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: demo-key-0001" \
  -H "Content-Type: application/json" \
  -d '{"amountMinor":1000000,"paidAt":"2026-10-24","method":"upi","reference":"UPI/1234"}'
```

[docs/08-api-reference.md](docs/08-api-reference.md) lists every endpoint.

## Verified

Last run on 2026-10-24 on Windows 11, Node 22.20.0, npm 11.19.1, MongoDB 8.2.6 from `mongodb-memory-server`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | passes in shared, server, web, mobile |
| `npm run lint` | passes, no warnings |
| `npm run format:check` | passes |
| `npm test` | 214 tests: 62 shared, 141 server, 11 web |
| Server suite | real HTTP through Supertest against a real MongoDB process |
| `npm run seed` | 6 customers, 8 products, 12 invoices, 1 void, 1 draft, 3 overdue |
| `npm run build` | server emits `dist`, web bundle builds at 507 kB (149 kB gzipped) |
| Browser run | signed in as the demo owner, dashboard, invoice detail, recorded a payment through the dialog |
| `expo export --platform android` | Metro bundled the app to 3 MB of Hermes bytecode with no unresolved imports |

The browser run is the important one. It used the built app against the real API with the real cookie session: sign in, dashboard with live counts, invoice detail with the IGST split, then record a payment and watch the invoice move to Paid, the balance reach zero and a history entry appear.

The web tests cover the session restore path (a stubbed 401 lands on sign in, a stubbed refresh lands on the dashboard), the error state when the dashboard fails, money and date formatting, and the invoice preview maths against the same numbers the server produces.

The mobile app has not been run on a device or emulator. Metro bundled it for Android without an unresolved import, and the TypeScript is clean, but "bundles" is not "works". Treat the mobile build as untested until Stage 7, and do not claim otherwise in the case study.

What the server suite proves, among 141 tests:

- Register, login, refresh rotation, refresh reuse detection, logout, logout-all, password change invalidating live tokens.
- Two accounts cannot see, edit, delete or bill each other's records. Cross tenant access returns 404.
- A token whose role was downgraded in the database is refused, because the role is read per request instead of trusted from the token.
- Invoice totals equal the line items to the paisa, IGST applies across states, discounts are taken before tax.
- 20 concurrent issue requests produce 20 unique sequential numbers.
- A repeated Idempotency-Key returns the same payment and charges once, including when both requests arrive together.
- Overpayment returns 409 with the current balance, and the balance is never left inconsistent.
- A void restores the balance and allows the invoice to be paid again.

Not verified: the mobile app has not run on a device or emulator yet, and no PDF has been generated. Stage 5 and Stage 6.

## The web app

Screens, all talking to the real API:

| Route | What it does |
| --- | --- |
| `/login`, `/register` | Session, with the demo credentials shown on the sign in card |
| `/dashboard` | Counts, revenue, a collected ratio bar, recent invoices and the overdue queue |
| `/customers` | Search, status filter, pagination, archive and delete guards |
| `/customers/new`, `/customers/:id`, `/customers/:id/edit` | Create, view with lifetime stats and invoice history, edit |
| `/products` | Search, active filter, activate and deactivate |
| `/products/new`, `/products/:id/edit` | Create and edit with a live GST preview |
| `/invoices` | Filters for status, payment state and overdue, plus search and pagination |
| `/invoices/new`, `/invoices/:id/edit` | The editor: customer, dates, place of supply, line items with product prefill, and a sticky totals panel computing with the shared money functions |
| `/invoices/:id` | Detail with the tax split, items, payments, history, issue, duplicate, void and record payment |
| `/payments` | Every payment, filters, void with a reason |
| `/reports` | Summary, revenue by month, GST by rate, outstanding aging, top customers |
| `/settings` | Business profile, invoice defaults and bank details, your profile, password change |

The access token is held in memory only. A page load calls `POST /auth/refresh`, the httpOnly cookie restores the session, and any 401 triggers one shared refresh for every request in flight. Nothing script-readable is stored in localStorage.

The editor previews totals with the same shared functions the server uses, so the number on screen is the number that will be stored. The server still recomputes everything.

Forms use React Hook Form with Zod schemas that mirror the server rules, through a small resolver written in this repo rather than a package that fought npm's resolver.
## The PDF

`GET /api/v1/invoices/:id/pdf` returns `application/pdf` built from the stored invoice, never from client input. The web app fetches it with the bearer token and downloads a blob; the mobile app writes it to the cache and opens the share sheet.

The document carries the business and customer snapshots, the invoice number and dates, line items with HSN, quantities, rates and GST, the tax split, total, amount paid, balance, the amount in words, bank details, terms, notes and a footer with the page count. Drafts and void invoices print a watermark.

Three details that matter more than they look:

1. **The rupee glyph is embedded.** Noto Sans ships in `server/assets/fonts` so `₹` renders the same on every machine instead of depending on a system font. That adds about 1.1 MB of fonts to the repo.
2. **Text is cleaned, not escaped.** pdfkit does not interpret markup, so the risk is control characters and layout, not injection. `cleanText` strips C0 controls, collapses whitespace and caps length. A test renders an invoice for a customer called `<script>alert(1)</script>`.
3. **Page breaks are manual.** The table measures each row, starts a new page when it would cross the footer band, and redraws the header. The footer resets the bottom margin while it draws, otherwise pdfkit adds a blank page every time a footer lands inside the margin.
## The mobile app

An Expo app with Expo Router, not a WebView. Tabs for Home, Invoices, Customers and More, with stacked screens for invoice detail and creation.

| Screen | What it does |
| --- | --- |
| Sign in, Register | Session with the mobile refresh flow, demo credentials shown |
| Home | Counts, revenue with a collected bar, recent and overdue invoices, pull to refresh |
| Invoices | Filter chips for all, unpaid, overdue and drafts, tap through to detail |
| Invoice detail | Tax split, items, payments, history, issue, duplicate, void and record a payment |
| New invoice | Customer picker, product picker or blank lines, quantity, price, GST rate, live totals |
| Customers | Search, tap through to contact, lifetime value and a shortcut to invoice them |
| More | Business summary, products list, settings, sign out |

Tokens: the refresh token goes into Expo SecureStore and the access token stays in memory. Every request carries `X-Client-Platform: mobile`, so the API returns the rotated refresh token in the body rather than a cookie. A 401 triggers one shared refresh, then a single retry.

On an Android emulator `localhost` is the emulator itself, so set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`:

| Target | Value |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000/api/v1` |
| iOS simulator | `http://localhost:4000/api/v1` |
| Physical phone on the same Wi-Fi | `http://192.168.x.x:4000/api/v1` |

The API already binds `0.0.0.0`, so a phone on the network can reach it.
## Money rules

Amounts are integer paise. Quantities are integer thousandths, so 1.5 units is `1500`. Rates are integer basis points, so 18% is `1800`. Calculations run through `BigInt` and round once per step, half away from zero.

`computeLineItem` computes gross, discount, taxable value and tax in that order, per line. Invoice totals are sums of already rounded lines, which is why the lines always add up to the printed total. CGST takes the rounded half and SGST the remainder, so an odd paisa cannot make the split disagree with the line tax.

The server recomputes every total on create, update and issue. A request that includes `totals`, `status` or `invoiceNumber` is rejected, not silently corrected.

Calendar dates are stored at UTC midnight and compared as UTC, so a due date cannot shift by a day because of a time zone.

## Security notes

- Passwords use argon2id at 19 MiB, time cost 2.
- Access tokens are 15 minute HS256 JWTs. Refresh tokens are 32 random bytes, stored as SHA-256 hashes, rotated on every use, and a replayed token revokes the whole family.
- Web refresh tokens live in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Mobile stores its refresh token in SecureStore and sends it with `X-Client-Platform: mobile`.
- Rate limits: 300/min per IP, 10 login attempts per 15 minutes, 5 registrations per hour, plus a 15 minute lock per email after 5 failed passwords.
- Logs redact authorization headers, cookies and tokens.
- 404 is returned for another tenant's records so the API does not confirm they exist.
- No `sanitizeFilter`. It rewrites `{ $gte: x }` into `{ $eq: { $gte: x } }` and broke the conditional balance update. Filters are built server side from validated primitives, never from a client object.

## Known limitations

- Rate limits and login lockouts are per process, so a multi instance deployment needs a shared store.
- No email sending. Password reset returns 503 `MAIL_NOT_CONFIGURED` rather than pretending.
- No payment gateway. Payments are recorded manually.
- No transactions. Payment consistency uses one atomic conditional update and a compensating delete; the reasoning is in `docs/03-architecture.md`.
- `npm audit` reports 5 high advisories inside `@expo/cli` only. The API's Zod is 4.6.7, above the fixed version. `audit fix --force` would downgrade Expo to 54, so it is documented rather than applied.
- Server tests take about two minutes because each suite talks to a real MongoDB.

## Repo layout

```
apps/web        React + Vite + Tailwind web app
apps/mobile     Expo React Native app
packages/shared Zod schemas, types, money and tax math
server          Express API, Mongoose models, OpenAPI
docs            Requirements, architecture, data model, API, roadmap
```

## Licence

Not decided yet. Add one before publishing a public demo.
