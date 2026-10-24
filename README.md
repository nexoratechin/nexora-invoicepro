# Nexora InvoicePro

Invoice and billing system for small Indian businesses. GST invoices, customers, products, payments, reports, and a server-generated PDF, on web and on mobile, against one API and one database.

Built by [Nexora Technologies](https://github.com/nexoratechin). Innovate | Automate | Transform.

## Status

Stage 1 of 9 is complete: scope, architecture, data model, API plan, screens and roadmap.

There is no application code yet. Stage 2 sets up the workspace, Stage 3 builds the API. This README will grow with real setup and run instructions as each stage lands. Anything not yet built is listed under "Not built yet" rather than described as if it works.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/01-requirements.md](docs/01-requirements.md) | MVP scope, functional and non-functional requirements, money and rounding policy, acceptance criteria |
| [docs/02-user-flows.md](docs/02-user-flows.md) | Actors, use case diagram, six end-to-end flows |
| [docs/03-architecture.md](docs/03-architecture.md) | System and deployment diagrams, request lifecycle, auth design, tenancy rules, repo layout, security controls |
| [docs/04-database-design.md](docs/04-database-design.md) | ER diagram, collection schemas, indexes, tenant ownership, snapshot strategy, seed data |
| [docs/05-api-plan.md](docs/05-api-plan.md) | Endpoint tables, request and response shapes, error codes, rate limits |
| [docs/06-screens.md](docs/06-screens.md) | Web routes, mobile routes, shared components, brand tokens |
| [docs/07-roadmap.md](docs/07-roadmap.md) | Nine stages with deliverables, acceptance criteria and estimates |

## Planned stack

| Layer | Choice |
| --- | --- |
| Web | React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form, Zod, Lucide |
| Mobile | React Native, Expo, Expo Router, TypeScript, Expo SecureStore |
| API | Node.js, Express, TypeScript, Zod, Mongoose |
| Database | MongoDB (Atlas for hosted, local for development) |
| PDF | pdfkit with an embedded Noto Sans font |
| Tests | Vitest, React Testing Library, Supertest, mongodb-memory-server |
| Deploy | Render (API), Vercel (web), MongoDB Atlas, EAS Build (Android) |

## Key design decisions

Money is stored as integer paise, never floating point rupees. Quantities are integer thousandths and percentages are integer basis points, so every amount is computed with integer arithmetic and rounded once per step using round-half-up.

The server computes all invoice totals. A total sent by a client is discarded, and a test asserts that.

Overdue is derived from due date and outstanding balance, not stored as a status, so it cannot go stale.

A payment uses a single atomic conditional update on the invoice document instead of a transaction. Two concurrent payments cannot both overdraw the balance, and local development does not need a replica set.

Issued invoices store snapshots of the customer, the business and every line, so editing a customer never rewrites an old invoice.

Invoice numbers come from a per-business, per-fiscal-year counter document updated with `$inc` under a unique index.

Every business-owned query filters on the `businessId` that comes from the access token, and cross-tenant access returns 404.

## Not built yet

Everything. Current state, by design, is documentation only.

Known limitations that will still apply at MVP:

- No payment gateway. Payments are recorded manually.
- No email sending. PDFs are downloaded or shared.
- No offline editing on mobile.
- Rate limiting is in memory, so it assumes one API instance.
- iOS distribution is documented but not performed, since it needs a paid Apple Developer account.
- Tax figures are software calculations, not tax advice.

## Getting started

Nothing to run yet. Once Stage 2 lands, this section will have the clone, install and run commands, and the `.env.example` files.

Requirements the project will target: Node.js 22 or newer, npm 10 or newer, Git, and either a MongoDB Atlas connection string or a local MongoDB 7 installation.

## Repository layout

```
apps/web        React + Vite web app       (Stage 4)
apps/mobile     Expo React Native app      (Stage 5)
packages/shared Zod schemas, types, money and tax math (Stage 2)
server          Express API, Mongoose models, PDF      (Stage 3)
docs            Requirements, architecture, data model, API, roadmap
```

## Branching

`main` holds reviewed work. Each stage is built on its own branch and merged when its acceptance criteria pass.

| Branch | Purpose |
| --- | --- |
| `main` | Stable history |
| `stage-1/architecture` | This documentation set |

## Licence

Not decided yet. Add one before publishing a public demo.
