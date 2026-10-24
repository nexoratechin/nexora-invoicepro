# Stage 7 - Test and security report

Run on 2026-10-24 on Windows 11. Node 22.20.0, npm 11.19.1, MongoDB 8.2.6 from `mongodb-memory-server`, Chrome 150 for the browser checks.

This report says what was actually run. Where something was not run, it says so instead of implying coverage.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck` | passes in shared, server, web, mobile |
| `npm run lint` | passes, 0 errors, 0 warnings |
| `npm run format:check` | passes |
| `npm test` | 285 tests pass across three workspaces |
| `npm run build` | server emits `dist`; web bundle 519 kB, 152 kB gzipped |
| `npx expo export --platform android` | 3 MB Hermes bundle, no unresolved imports |
| `npm run seed` | 6 customers, 8 products, 12 invoices, 1 draft, 1 void, 3 overdue |

| Workspace | Tests | What they cover |
| --- | --- | --- |
| `packages/shared` | 62 | money rounding, GST maths, payment state, overdue, date helpers |
| `server` | 173 | auth, tenancy, CRUD, invoice lifecycle, payments, reports, PDF, security, performance |
| `apps/web` | 22 | session restore, dashboard states, formatting, editor preview, colour contrast |

## Security checks, with results

| Control | Verified by | Result |
| --- | --- | --- |
| Every protected route needs a token | `security.test.ts`, 42 routes in a matrix | 401 on all of them |
| Role guard blocks staff from settings, deletes, voids | role matrix after downgrading the membership row | 403 on all of them |
| Staff keep read and create access | same file | 200 / 201 |
| Tenant isolation on customers, products, invoices, payments, PDF | `tenant.test.ts`, `invoices.test.ts`, `payments.test.ts`, `pdf.test.ts` | 404, not 403 |
| A token holder cannot pass a `businessId` in body or query | strict schemas | 400 |
| Password hash and token hashes never serialised | recursive key scan of four responses | absent |
| Web refresh token never in a response body | login with no mobile header | absent, `HttpOnly` cookie set |
| Passwords never echoed | profile update response body | absent |
| Body over 1 MB | 1.1 MB request | 413 |
| Malformed JSON | broken body | 400, not 500 |
| Security headers present | response headers | CSP, nosniff, no `X-Powered-By`, no-referrer |
| Unknown browser origin gets no CORS grant | request with a foreign Origin | no `access-control-allow-origin` |
| Refresh reuse revokes the family | `auth.test.ts` | replay and the rotated token both 401 |
| Password change invalidates live tokens | `auth.test.ts` | old access token 401 immediately |

Not verified, and not claimed:

- No penetration test and no external security review.
- Rate limiting is exercised only by reading the code. Tests skip the limiter, so no test asserts a 429. The limiter is in-memory, so it does not hold across instances.
- No CSRF token. The refresh cookie is `SameSite=Strict` and scoped to `/api/v1/auth`; no other endpoint reads a cookie. A formal CSRF test was not written.
- No dependency review beyond `npm audit`, whose findings are all inside `@expo/cli` (documented in the README).

## Performance with 10,000 invoices

Seeded straight into MongoDB, then measured over HTTP through Supertest. Single process, local database, full test suite running: these are relative numbers, not a production benchmark. Two runs differed by about 30 percent, which is why the assertions use 2 to 3 second bounds rather than the measurements.

| Request | Time |
| --- | --- |
| `GET /invoices?pageSize=20&sort=-invoiceDate` | 413 ms |
| `GET /invoices?q=PERF/2026-27/09999` | 478 ms |
| `GET /invoices?overdue=true` | 128 ms |
| `GET /dashboard?from=2020-01-01&to=2030-12-31` | 449 ms |
| `GET /reports/gst?from=2020-01-01&to=2030-12-31` | 171 ms |

The list and the search are the slowest because they count the full match set for pagination and, for search, also look up matching customer names. Both are under half a second on 10,000 records. The overdue filter is fast because the compound index covers it.

Indexes asserted in the test: `businessId,invoiceNumber`, `businessId,status,invoiceDate`, `businessId,status,dueDate,balanceDueMinor`.

## Accessibility

Automated:

- Colour contrast is computed in `apps/web/src/lib/contrast.test.ts` for every text token against the surfaces it appears on. All pairs clear WCAG AA at 4.5:1. Body ink on white is 17.2:1, muted text 6.8:1, white on the primary blue 4.8:1.
- Every form field has a `<label htmlFor>` or an `aria-label`, checked by reading the markup and by `getByLabelText` usage in tests.
- Destroy buttons carry `aria-label`. Status is conveyed in words (Draft, Overdue, Paid), not colour alone.
- A skip link to `#main-content` is the first focusable element.
- The mobile menu trigger reports `aria-expanded` and `aria-controls`.
- Focus outlines are never removed; `:focus-visible` draws a 2 px ring.

Not done:

- No screen reader pass. Nobody has driven this with NVDA, VoiceOver or TalkBack.
- No automated accessibility runner (axe) in the suite.
- No 200% zoom check in a real browser beyond responsive layout at 375, 768, 1024 and 1440 px.
- Dark mode is not implemented. The tokens exist and a dark theme would be a token pass, but shipping a half styled dark mode would be worse than none. The design brief said "where practical".

## What is still unproven

| Claim | Status |
| --- | --- |
| The mobile app works | Not run on a device or emulator. Metro bundled it. The share sheet and SecureStore are unexercised. |
| The deployed system works | Nothing is deployed yet. |
| PDFs match the screen for every invoice shape | One rendered PDF was converted to a PNG and inspected; tests assert structure, not pixels. |
| Rate limits hold under load | Reasoned from code, not measured. |
| Behaviour under concurrent writes beyond the tests | The numbering and payment races are tested with 20 and 2 parallel requests, not hundreds. |

## Bugs found and fixed during the build

Recorded because the fixes explain some of the code:

1. Mongoose 9 requires `updatePipeline: true` for array updates and rejects `$push` as a pipeline stage. Event history uses `$concatArrays`.
2. Malformed JSON returned 500. It returns 400 now. Found by curling the running server, not by the suite.
3. Request bodies reached the error log on a parse failure. `body` and `err.body` are redacted.
4. `sanitizeFilter` silently rewrote `{ $gte: x }` into `{ $eq: { $gte: x } }`, breaking the conditional balance update behind every payment.
5. The PDF footer, drawn inside the bottom margin, made pdfkit add a blank page per footer. A six line invoice came out as three pages.
6. The auth routes were not nested in `AuthLayout`, so sign in rendered with no styling. Found by looking at a screenshot after all tests passed.

## Gaps worth fixing next

1. Device test the mobile app, then wire `expo-file-system` sharing through a real share sheet.
2. Add axe to the web tests and one Playwright journey across login, invoice creation and PDF download.
3. Move rate limiting and the login lockout to a shared store before running more than one API instance.
4. Split the web bundle by route; 519 kB in one chunk is the largest remaining front-end cost.
5. Decide on dark mode: implement it as a token pass, or drop it from the brief in writing.
