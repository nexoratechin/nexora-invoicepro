# Stage 1 - Screen list

## Web routes

| Route | Screen | Key content | States |
| --- | --- | --- | --- |
| `/` | Redirect | To `/dashboard` when signed in, `/login` otherwise | - |
| `/login` | Login | Email, password, show password, submit, register link | idle, submitting, invalid credentials, rate limited, server waking |
| `/register` | Registration | Name, email, password with strength hint, business name, state | idle, field errors, email taken, submitting |
| `/forgot-password` | Forgot password | Email, submit, back to login | hidden when SMTP is not configured |
| `/reset-password/:token` | Reset password | New password, confirm | invalid or expired token |
| `/dashboard` | Dashboard | 6 stat cards, revenue summary, range picker, recent invoices, overdue list | loading skeleton, empty for new account, error with retry |
| `/customers` | Customer list | Search, status filter, table, pagination, new button | loading, empty, no results, error |
| `/customers/new` | Create customer | Form in a card, inline address block | field errors, saving |
| `/customers/:id` | Customer detail | Contact card, stats, invoice history table | loading, not found, error |
| `/customers/:id/edit` | Edit customer | Same form, prefilled, archive and delete actions | delete blocked with reason |
| `/products` | Products | Search, active filter, table with price and tax, toggle active | loading, empty, error |
| `/products/new` | Create product | Form | field errors |
| `/products/:id/edit` | Edit product | Form, deactivate | in use warning |
| `/invoices` | Invoice list | Filters for status, payment state, date range, customer, search; table; pagination | loading, empty, no results, error |
| `/invoices/new` | Create invoice | Left: customer picker, line item editor, notes, dates, place of supply. Right: sticky totals panel with live preview | dirty form guard, validation, saving draft, issuing |
| `/invoices/:id` | Invoice detail | Header with number, status badge, actions. Items table, totals card, payments card, history timeline | loading, not found, void, paid |
| `/invoices/:id/edit` | Edit draft | Same editor, draft only | redirect to detail when not draft |
| `/payments` | Payments | Table of all payments, date and method filters, void action | loading, empty, error |
| `/reports` | Reports | Tabs for revenue, outstanding, GST, top customers, with date range | loading, empty, error |
| `/settings/business` | Business profile | Name, address, GSTIN, contact, state | saving, logo upload errors |
| `/settings/invoicing` | Invoicing | Prefix, terms, default tax, notes, bank details | saving, prefix conflict warning |
| `/settings/profile` | Profile | Name, phone, change password, sessions | saving |
| `*` | Not found | Message and a link home | - |

Layouts: `AuthLayout` for the auth screens (centred card, brand mark, gradient edge), `AppLayout` for the rest (sidebar on desktop, top bar with a drawer below 768 px).

## Mobile routes

Expo Router, file based.

| Route | Screen | Notes |
| --- | --- | --- |
| `app/(auth)/login.tsx` | Login | Keyboard avoiding, secure text entry toggle |
| `app/(auth)/register.tsx` | Register | Scrollable, field-level errors |
| `app/(tabs)/index.tsx` | Dashboard | Stat cards, recent invoices, pull to refresh |
| `app/(tabs)/invoices.tsx` | Invoice list | Filter chips, infinite scroll or pagination |
| `app/(tabs)/customers.tsx` | Customers | Search, list, add button |
| `app/(tabs)/more.tsx` | More | Reports, payments, settings, profile, logout |
| `app/invoices/new.tsx` | Create invoice | Customer picker, line items, totals, save draft or issue |
| `app/invoices/[id].tsx` | Invoice detail | Status, items, totals, payments, download and share PDF, record payment |
| `app/customers/[id].tsx` | Customer detail | Contact, stats, invoices |
| `app/customers/new.tsx` | Create customer | Modal |
| `app/products/index.tsx` | Products | Search and select |
| `app/payments/index.tsx` | Payments | List and void |
| `app/settings/index.tsx` | Business settings | Profile and invoicing fields |
| `app/settings/profile.tsx` | Profile | Name, phone, password, logout |
| `app/+not-found.tsx` | Not found | Back to dashboard |

## Shared components

Web `components/ui`: `Button` (primary, secondary, ghost, danger; loading state), `Input`, `Textarea`, `Select`, `Combobox`, `DateField`, `Table` (stacks into cards below 768 px), `Dialog`, `Sheet`, `Badge` (status and payment state), `Card`, `StatCard`, `EmptyState`, `Skeleton`, `Toast`, `Pagination`, `MoneyInput`, `TaxRatePicker`, `Logo`.

Mobile `src/ui`: `Screen`, `Card`, `Button`, `TextField`, `MoneyField`, `StatusChip`, `EmptyState`, `ErrorBanner`, `Loading`, `SectionHeader`, `Fab`, `KeyValueRow`.

## Brand

Wordmark: geometric N, drawn as SVG. Two vertical strokes and a diagonal, with the diagonal in a cyan to blue gradient. The same path is used at 24 px in the sidebar and at 60 px on the auth screens.

Colours:

| Token | Hex | Use |
| --- | --- | --- |
| `navy` | `#0A1B35` | Dark surface, headings, sidebar |
| `blue` | `#0066FF` | Primary action, links, focus ring |
| `cyan` | `#00D4FF` | Accent, gradient end, active indicator |
| `white` | `#FFFFFF` | Cards on dark, text on blue |
| `mist` | `#F8FAFF` | Page background |

Typography: one sans family with a variable weight axis, loaded locally so the app works offline and does not depend on a third party CDN. Headings at 600 weight, body at 400, tabular numbers for money so columns align.

Dark mode follows the OS setting and has a manual override stored in preferences. Status colours are defined once and mapped in both themes so a badge never becomes unreadable.

## Status vocabulary

| Value | Label | Colour intent |
| --- | --- | --- |
| `draft` | Draft | neutral grey |
| `issued` + `unpaid`, not due | Unpaid | amber |
| `issued` + `unpaid`, past due | Overdue | red |
| `issued` + `partial` | Part paid | blue |
| `issued` + `paid` | Paid | green |
| `void` | Void | grey with strikethrough number |

Every badge carries the word, not just the colour. A colour-blind user reads the same information.
