# Stage 1 - Roadmap

Nine stages from here to a deployed portfolio project. Estimates assume one developer working evenings, and they are guesses: the first time you build an invoice PDF it takes longer than you think.

| Stage | Deliverable | Done when | Estimate |
| --- | --- | --- | --- |
| 1 | Requirements, diagrams, API plan, screens, roadmap | This folder reviewed and agreed | done |
| 2 | Repo, workspaces, TypeScript, lint, format, env, shared package skeleton | `npm run typecheck` and `npm run lint` pass on an empty skeleton | done |
| 3 | Models, auth, tenancy, customers, products, invoices, payments, reports API | API tests green, Swagger served, seed script works | done |
| 4 | Web app on the real API | Every MVP screen works against the API, no mock data | done |
| 5 | Expo app on the same API | Android build runs the full loop on a device | 5 to 7 days |
| 6 | PDF, tax edge cases, numbering under concurrency, payment idempotency | Invoice PDF matches the API to the paisa, tax tests green | 3 to 4 days |
| 7 | Test sweep, security review, responsive checks, accessibility pass | Report in `docs/` listing what is tested and what is not | 3 to 4 days |
| 8 | Deploy API, database, web; Android build; document iOS steps | A stranger can sign up on the deployed URL | 2 to 3 days |
| 9 | README, screenshots, case study, demo script | Portfolio page ready to send | 2 days |

Total: roughly 30 to 40 working days. The API stage and the web stage are the two long ones. If time runs out, the mobile app is the part to cut, not the tests.

## Stage 2 - Foundation

Objective: a repo that installs and lints cleanly before any feature code exists.

Files: root `package.json` with npm workspaces, `.gitignore`, `.editorconfig`, `.prettierrc`, `tsconfig.base.json`, `apps/web` Vite scaffold, `apps/mobile` Expo scaffold, `packages/shared` with the money and tax functions plus their tests, `server` skeleton with Express, helmet, cors, a health route, and env parsing.

Verify: `npm install` at the root, `npm run dev` starts the API and the web app, `npm test` runs the shared package tests, `npm run lint` passes.

Nothing here is feature work. The point is that Stage 3 does not fight the toolchain.

## Stage 3 - Backend

Order matters. Each step is testable before the next starts.

1. Database connection and env validation.
2. User, Business, Membership, BusinessSettings models.
3. Auth service and routes, with tests for register, login, refresh rotation, reuse detection, logout.
4. Auth middleware, tenant middleware, role guard, with a cross-tenant test that creates two accounts.
5. Customer and Product CRUD, with tests for search, archive, and delete blocking.
6. Money and tax functions in `packages/shared`, with a table of test cases including the 0.5 paisa rounding edge.
7. Invoice model and engine: create draft, recompute totals, update draft.
8. Numbering service with a concurrency test that fires 20 parallel issues.
9. Issue, void, duplicate, with status transition tests.
10. Payments with idempotency and the conditional balance update, plus a two-writer race test.
11. Dashboard and report aggregations.
12. Swagger from the route schemas.
13. Seed script.

Done when `npm test` in `server` passes with a real HTTP test for every endpoint, and a manual curl walkthrough in the README reproduces the invoice lifecycle.

## Stage 4 - Web

Order:

1. Design tokens, Tailwind theme, base components, N brand mark.
2. API client with token refresh, error mapping, and a typed wrapper around `fetch`.
3. Auth screens, protected layout, session restore on reload.
4. Dashboard with real stats.
5. Customers, then products.
6. Invoice editor: the hard screen. Build the line item table first, wire totals second, only then add dates, notes and place of supply.
7. Invoice detail with actions, PDF download, payments.
8. Reports and settings.
9. Empty, loading and error states for every screen.
10. Responsive pass at 375, 768, 1024 and 1440 px. Dark mode pass.

## Stage 5 - Mobile

Order:

1. Expo Router shell, tab layout, theme.
2. Secure token storage and an API client that shares logic with web where it can.
3. Auth screens.
4. Dashboard.
5. Customers and products.
6. Invoice creation. On a phone this is a different screen, not a squeezed table: one line per card, with add and remove.
7. Invoice detail, PDF download, share sheet.
8. Payments.
9. Settings and profile.
10. Device testing: Android emulator, a physical Android phone over LAN, and an iOS simulator if a Mac is available. Note that iOS distribution needs an Apple Developer account, which is outside this project's budget.

## Stage 6 - Money and documents

The stage that decides whether this project is credible.

- Tax tests: intra-state 18% splits 9 and 9, odd paise goes to CGST, inter-state 18% becomes IGST, 0% and 5% slabs, discount before tax, quantity with three decimals.
- Rounding tests: a line whose tax lands on exactly 0.5 paisa rounds up, and the totals still add up.
- Numbering test: 20 concurrent issues produce 20 unique sequential numbers, no gaps beyond the retry cases.
- Payment tests: overpayment rejected, duplicate idempotency key returns one payment, void restores balance, partial then full lands on paid.
- PDF: render a fixture invoice, assert the text contains the number and total, assert a name with `<script>` renders as literal text, assert a 40-line invoice paginates without clipping.

## Stage 7 - Review

- Backend: run the cross-tenant suite, check every route for a scoped query, check every `req.body` for a schema, check logs for leaked tokens.
- Frontend: keyboard-only pass on the invoice editor, contrast check on badges in dark mode, 200% zoom on the tables.
- Performance: seed 10,000 invoices and time the list and dashboard endpoints.
- Write `docs/09-test-report.md` listing what passed, what was not run, and what is knowingly missing. Honest gaps score better than invented coverage.

## Stage 8 - Deploy

1. MongoDB Atlas free tier, database user restricted to the app database, IP allowlist set to the host.
2. API on Render: build command, start command, all env vars, persistent disk for uploads.
3. Web on Vercel with `VITE_API_URL` pointing at the Render URL, and `WEB_ORIGIN` on the API pointing back at Vercel.
4. Smoke test the deployed flow: register, create invoice, PDF, payment.
5. Android build with EAS, install the APK on a phone, test against the deployed API.
6. Document the iOS path: Apple Developer account, EAS credentials, TestFlight, and note it is not done.

## Stage 9 - Portfolio

README with a short product description, architecture diagram, screenshots, a demo login, and setup steps that a stranger can follow. A case study that says what broke, what the trade-offs were, and what is still missing. A two minute demo recording that follows one invoice from customer to paid.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Invoice editor scope creep | Blocks the web stage | Ship the line table and totals first; dates and notes after |
| Rupee glyph missing in PDF font | Broken PDFs | Embed Noto Sans in Stage 6 and test the glyph, not just the build |
| Atlas free tier sleeping or hitting limits | Demo fails live | Document cold start, add a keep-warm ping, keep the demo dataset small |
| Token refresh races on web | Random logouts | Single-flight refresh in the API client, written in Stage 4 |
| Time slipping to the mobile app | Nothing deployed | Mobile is the cut line; web and API deploy regardless |
| Learning TypeScript generics mid-build | Slow debugging | Shared package keeps types simple, no clever conditional types |

## Working agreement

One stage per session. Each session ends with the exact commands run, what passed, what was not run, and the next step. No claim of a passing test that was not executed. If a command fails, it gets fixed before the next stage starts.
