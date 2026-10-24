# Stage 1 - Users, use cases and flows

## Actors

| Actor | Description |
| --- | --- |
| Visitor | Not signed in. Can register or log in. |
| Owner | Created the business. Full access including settings, void, delete. |
| Admin | Team member with settings and delete rights. Post-MVP UI. |
| Staff | Team member who can create customers, products, invoices and payments. Post-MVP UI. |
| Scheduler | Server-side clock that makes invoices overdue. Derived at read time, no job needed. |

## Use case diagram

```mermaid
flowchart LR
    Visitor(["Visitor"])
    Owner(["Owner"])
    Admin(["Admin"])
    Staff(["Staff"])

    subgraph SYS["Nexora InvoicePro (MVP)"]
        UC1["Register business"]
        UC2["Log in"]
        UC3["Refresh session"]
        UC4["Manage profile"]
        UC5["Manage business settings"]
        UC6["Upload logo"]
        UC7["Manage customers"]
        UC8["Manage products"]
        UC9["Create and edit draft invoice"]
        UC10["Issue invoice"]
        UC11["Void invoice"]
        UC12["Duplicate invoice"]
        UC13["View invoice and download PDF"]
        UC14["Record payment"]
        UC15["Void payment"]
        UC16["View dashboard"]
        UC17["View reports"]
        UC18["Search and filter"]
    end

    Visitor --> UC1
    Visitor --> UC2
    Owner --> UC3
    Owner --> UC4
    Owner --> UC5
    Owner --> UC6
    Owner --> UC7
    Owner --> UC8
    Owner --> UC9
    Owner --> UC10
    Owner --> UC11
    Owner --> UC12
    Owner --> UC13
    Owner --> UC14
    Owner --> UC15
    Owner --> UC16
    Owner --> UC17
    Owner --> UC18
    Admin --> UC5
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
    Admin --> UC11
    Admin --> UC16
    Admin --> UC17
    Staff --> UC7
    Staff --> UC8
    Staff --> UC9
    Staff --> UC10
    Staff --> UC13
    Staff --> UC14
    Staff --> UC18
```

## Flow 1 - First run

```mermaid
flowchart TD
    A["Open app"] --> B{"Has refresh token?"}
    B -- no --> C["Login screen"]
    B -- yes --> D["POST /auth/refresh"]
    D --> E{"Valid?"}
    E -- yes --> F["Dashboard"]
    E -- no --> C
    C --> G["Register link"]
    G --> H["Name, email, password, business name"]
    H --> I{"Server validation"}
    I -- fail --> J["Field errors, keep input"]
    J --> H
    I -- pass --> K["Create user, business, owner membership, default settings"]
    K --> L["Issue access + refresh token"]
    L --> M["Dashboard with empty states"]
```

The dashboard for a brand new account shows three empty-state cards: no customers, no products, no invoices. Each card links to the matching create form. No placeholder numbers appear.

## Flow 2 - Raise and issue an invoice

```mermaid
flowchart TD
    A["Invoices list"] --> B["New invoice"]
    B --> C["Pick customer, or create one inline"]
    C --> D["Add line items"]
    D --> E["Pick product, or type a description"]
    E --> F["Set quantity, price, discount, tax rate"]
    F --> G["Client shows a preview total"]
    G --> H{"Save draft or issue?"}
    H -- draft --> I["POST /invoices with status draft"]
    I --> J["Draft saved, no number assigned"]
    J --> D
    H -- issue --> K["POST /invoices/:id/issue"]
    K --> L{"Server recomputes money and validates"}
    L -- invalid --> M["Return field errors, stay on draft"]
    M --> D
    L -- valid --> N["Assign number, snapshot customer and business, freeze content"]
    N --> O["Invoice detail, issued"]
    O --> P["Download or share PDF"]
```

The preview total on the client uses the same shared money functions as the server, so the number the user sees is the number the server stores. The server still ignores whatever total the client sends.

## Flow 3 - Record a part payment

```mermaid
flowchart TD
    A["Invoice detail"] --> B["Record payment"]
    B --> C["Amount, date, method, reference"]
    C --> D{"Amount <= balance?"}
    D -- no --> E["Inline error: amount exceeds balance of X"]
    E --> C
    D -- yes --> F["POST /invoices/:id/payments with client request id"]
    F --> G{"Duplicate request id?"}
    G -- yes --> H["Return the existing payment, no second charge"]
    G -- no --> I["Atomic balance decrement"]
    I --> J{"Matched invoice with enough balance?"}
    J -- no --> K["409, refresh invoice, show current balance"]
    J -- yes --> L["Payment stored, invoice payment state recomputed"]
    L --> M["Detail shows paid, balance, and payment row"]
```

## Flow 4 - Void

```mermaid
flowchart TD
    A["Invoice detail"] --> B["Void"]
    B --> C["Reason required"]
    C --> D{"Payments exist?"}
    D -- yes --> E["Blocked: void the payments first, list them"]
    D -- no --> F["Confirm dialog names the invoice number"]
    F --> G["POST /invoices/:id/void"]
    G --> H["Status void, history entry with reason and user"]
    H --> I["Excluded from revenue, PDF shows VOID watermark"]
```

Voided invoices stay in the list behind the "void" filter. Nothing is deleted, because the number was issued and the record has to survive.

## Flow 5 - Session expiry on mobile

```mermaid
sequenceDiagram
    participant U as User
    participant M as Mobile app
    participant S as API
    M->>M: read access token from SecureStore
    M->>S: GET /invoices with Bearer token
    S-->>M: 401 TOKEN_EXPIRED
    M->>S: POST /auth/refresh with refresh token
    alt refresh valid
        S-->>M: new access + rotated refresh
        M->>M: write both to SecureStore
        M->>S: retry GET /invoices
        S-->>M: 200
    else refresh invalid
        S-->>M: 401
        M->>M: clear SecureStore
        M-->>U: redirect to login
    end
```

Refresh happens once per failure and is shared across concurrent requests, so ten parallel calls do not start ten refreshes.

## Flow 6 - Tenant isolation check

Every request that touches a business record follows this path:

1. Token verified. `req.auth = { userId, businessId, role }`.
2. The route handler reads `businessId` from `req.auth`. It never reads a business ID from the body, query string, or path.
3. The database query includes `businessId` in its filter.
4. A miss returns 404, not 403, so the API does not confirm that a foreign record exists.

The test suite asserts this for customers, products, invoices and payments by creating two accounts and trying each cross-tenant read, update and delete.
