# Nexora InvoicePro

Invoice and billing system for small Indian businesses. GST invoices, customers, products, payments, reports and a server-generated PDF, on web and on mobile, against one API and one database.

Built by [Nexora Technologies](https://github.com/nexoratechin). Innovate | Automate | Transform.

## Status

Stage 2 of 9 is complete. The workspace installs, typechecks, lints, tests and builds.

What exists today:

- A shared package with the integer-paise money engine and GST calculation, covered by 62 tests.
- An Express 5 API skeleton with helmet, a CORS allowlist, rate limiting, request ids, structured logs, one error envelope and 12 API tests.
- A React 19 web shell on Vite 8 and Tailwind 4, showing live API health, with 4 component tests.
- An Expo 58 mobile shell that runs the same money engine and calls the same health endpoint.

What does not exist yet: authentication, database models, screens for real business data, the PDF. Those are Stage 3 onward, as listed in [docs/07-roadmap.md](docs/07-roadmap.md).

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

## Getting started

Requirements: Node.js 22.13 or newer, npm 11 or newer, Git.

```bash
npm install
```

Copy the example env files. The API and web app run without edits; the copies exist so secrets never land in a tracked file.

```bash
cp server/.env.example server/.env
cp apps/web/.env.example apps/web/.env
cp apps/mobile/.env.example apps/mobile/.env
```

On PowerShell use `Copy-Item server/.env.example server/.env` for each file.

Run both the API and the web app:

```bash
npm run dev
```

- API on http://localhost:4000
- Web on http://localhost:5173

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run dev:api` | API only, with reload |
| `npm run dev:web` | Web app only |
| `npm run dev:mobile` | Expo dev server |
| `npm run typecheck` | TypeScript across shared, server, web, mobile |
| `npm run lint` | ESLint with type-aware rules |
| `npm run format` | Prettier write |
| `npm test` | Vitest in every workspace |
| `npm run build` | Production build of shared, server and web |

Check the API by hand:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/nope
```

The last one returns the error envelope with a 404 and a matching `requestId`.

### Mobile on a device

`localhost` means the phone itself, so the mobile `.env` needs a different host:

| Target | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000/api/v1` |
| iOS simulator | `http://localhost:4000/api/v1` |
| Physical phone on the same Wi-Fi | `http://192.168.x.x:4000/api/v1` |

The API already binds `0.0.0.0`, so a phone on the same network can reach it. On Windows, allow Node through the firewall for private networks the first time.

## Verified

Run on 2026-10-24 on Windows 11, Node 22.20.0, npm 11.19.1.

| Check | Result |
| --- | --- |
| `npm run typecheck` | passes in shared, server, web and mobile |
| `npm run lint` | passes, no warnings |
| `npm run format:check` | passes, 100 character width |
| `npm test` | 78 tests pass: 62 shared, 12 server, 4 web |
| `npm run build` | server emits `dist`, web emits a 227 kB bundle, 71 kB gzipped |
| `GET /health` | returns 200 with service, version, environment and uptime |
| Web shell | renders, calls the API, shows Connected when the API is up |

Versions in use: TypeScript 6.0.3, React 19.3, Vite 8.3, Vitest 5.0, Express 5.3, Zod 4.6, Tailwind 4.3, Expo 58, React Native 0.88.

TypeScript stays on 6.0 rather than 7.0 because `typescript-eslint` supports `<6.1.0`. Once it supports 7, the bump is a two-line change.

## Repo layout

```
apps/web        React + Vite + Tailwind web app
apps/mobile     Expo React Native app
packages/shared Zod schemas, types, money and tax math
server          Express API, Mongoose models, PDF
docs            Requirements, architecture, data model, API, roadmap
```

## How the money engine works

Amounts are integer paise. Quantities are integer thousandths, so 1.5 units is `1500`. Rates are integer basis points, so 18% is `1800`. Every calculation runs through `BigInt` and rounds once per step, half away from zero.

`computeLineItem` computes gross, discount, taxable value and tax in that order, per line. Invoice totals are sums of already-rounded line values, which is why the lines always add up to the printed total. The CGST half is rounded and SGST takes the remainder, so an odd paisa cannot make the split disagree with the line tax.

The web app and the mobile app call the same functions, so the number in the browser is the number the API will store.

## Known dependency advisories

`npm audit` reports 5 high severity advisories. All of them are inside `@expo/cli`, the Expo build tool: `node-forge@1.4.0`, `@expo/code-signing-certificates`, and a nested `zod@3.25.76`. None of them ship in the app bundle or the API runtime. The API's own Zod is 4.6.7, above the advisory's fixed version.

`npm audit fix --force` resolves them by downgrading Expo from 58 to 54, which would break the mobile app. Not applied. Revisit when Expo updates its CLI dependencies.

## Design decisions

Money as integers rather than floats, because float rupees drift by a paisa and then the PDF disagrees with the database.

Server-computed totals, because a client that can send a total can send the wrong one.

Overdue derived from due date and balance instead of stored, so it cannot go stale.

Payments by atomic conditional update on the invoice document instead of a transaction, so local development does not need a replica set.

Snapshots on issue, so editing a customer never rewrites an old invoice.

Invoice numbers from a per-business, per-fiscal-year counter updated with `$inc` under a unique index.

Tenant isolation by taking `businessId` only from the access token and filtering every query on it. Cross-tenant access returns 404.

## Not built yet

Authentication, MongoDB models, all business screens, PDF generation, and deployment. No email sending, no payment gateway, no offline editing. Rate limiting is in memory, so it assumes one API instance.

## Licence

Not decided yet. Add one before publishing a public demo.
