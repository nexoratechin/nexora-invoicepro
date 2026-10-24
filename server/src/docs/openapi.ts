const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const noContent = { description: 'No content' };

const bearer = [{ bearerAuth: [] }];

const idParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
};

const pagingParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    name: 'pageSize',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  { name: 'q', in: 'query', schema: { type: 'string' } },
];

const jsonBody = (ref: string) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: ref } } },
});

/**
 * Hand written so the contract is readable in one file. It documents the shapes
 * that matter for the invoice flow and points at the shared Zod schemas as the
 * source of truth for validation.
 */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Nexora InvoicePro API',
    version: '1.0.0',
    description:
      'Invoice and billing API for Nexora Technologies. Amounts are integer paise. The server computes every invoice total; client supplied totals are rejected. All business records are scoped to the business in the access token.',
  },
  servers: [{ url: '/api/v1', description: 'Versioned API' }],
  tags: [
    { name: 'Auth' },
    { name: 'Business' },
    { name: 'Customers' },
    { name: 'Products' },
    { name: 'Invoices' },
    { name: 'Payments' },
    { name: 'Reports' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string', examples: ['VALIDATION_FAILED'] },
              message: { type: 'string' },
              details: {},
              requestId: { type: 'string' },
            },
          },
        },
      },
      Address: {
        type: 'object',
        properties: {
          line1: { type: 'string' },
          line2: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          pincode: { type: 'string' },
          country: { type: 'string', default: 'India' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password', 'businessName', 'stateCode'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 80 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 10 },
          businessName: { type: 'string' },
          stateCode: { type: 'string', pattern: '^[0-9]{2}$', examples: ['24'] },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      CustomerInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          email: { type: 'string' },
          phone: { type: 'string' },
          gstin: { type: 'string' },
          stateCode: { type: 'string' },
          billingAddress: { $ref: '#/components/schemas/Address' },
          shippingAddress: { $ref: '#/components/schemas/Address' },
          notes: { type: 'string' },
        },
      },
      ProductInput: {
        type: 'object',
        required: ['name', 'unitPriceMinor', 'taxRateBp'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          sku: { type: 'string' },
          unitLabel: { type: 'string', default: 'unit' },
          unitPriceMinor: { type: 'integer', minimum: 0 },
          taxRateBp: { type: 'integer', enum: [0, 500, 1200, 1800, 2800] },
          isActive: { type: 'boolean', default: true },
        },
      },
      LineItemInput: {
        type: 'object',
        required: ['description', 'quantityMilli', 'unitPriceMinor', 'taxRateBp'],
        properties: {
          productId: { type: ['string', 'null'] },
          description: { type: 'string', maxLength: 500 },
          hsnSac: { type: 'string' },
          unitLabel: { type: 'string', default: 'unit' },
          quantityMilli: { type: 'integer', minimum: 1, examples: [1500] },
          unitPriceMinor: { type: 'integer', minimum: 0, examples: [2500000] },
          discountBp: { type: 'integer', minimum: 0, maximum: 10000 },
          taxRateBp: { type: 'integer', minimum: 0, maximum: 10000 },
        },
      },
      InvoiceInput: {
        type: 'object',
        required: ['customerId', 'invoiceDate', 'dueDate', 'lineItems'],
        properties: {
          customerId: { type: 'string' },
          invoiceDate: { type: 'string', format: 'date' },
          dueDate: { type: 'string', format: 'date' },
          placeOfSupplyStateCode: { type: 'string', pattern: '^[0-9]{2}$' },
          notes: { type: 'string' },
          terms: { type: 'string' },
          lineItems: {
            type: 'array',
            minItems: 1,
            maxItems: 200,
            items: { $ref: '#/components/schemas/LineItemInput' },
          },
        },
      },
      PaymentInput: {
        type: 'object',
        required: ['amountMinor', 'paidAt', 'method'],
        properties: {
          amountMinor: { type: 'integer', minimum: 1 },
          paidAt: { type: 'string', format: 'date' },
          method: {
            type: 'string',
            enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other'],
          },
          reference: { type: 'string' },
          note: { type: 'string' },
        },
      },
      InvoiceTotals: {
        type: 'object',
        properties: {
          subtotalMinor: { type: 'integer' },
          discountTotalMinor: { type: 'integer' },
          taxableTotalMinor: { type: 'integer' },
          cgstTotalMinor: { type: 'integer' },
          sgstTotalMinor: { type: 'integer' },
          igstTotalMinor: { type: 'integer' },
          taxTotalMinor: { type: 'integer' },
          roundOffMinor: { type: 'integer' },
          totalMinor: { type: 'integer' },
        },
      },
      Page: {
        type: 'object',
        properties: {
          items: { type: 'array', items: {} },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
  security: bearer,
  paths: {
    '/health': {
      get: {
        tags: ['Auth'],
        summary: 'Liveness probe',
        security: [],
        responses: { '200': { description: 'Service is up' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create a user, business, membership and default settings',
        security: [],
        requestBody: jsonBody('#/components/schemas/RegisterRequest'),
        responses: {
          '201': { description: 'Session created' },
          '409': errorResponse('Email already registered'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange credentials for an access token and a refresh token',
        security: [],
        requestBody: jsonBody('#/components/schemas/LoginRequest'),
        responses: {
          '200': { description: 'Session created' },
          '401': errorResponse('Wrong email or password'),
          '429': errorResponse('Too many attempts'),
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh token',
        security: [],
        description:
          'Web sends the nx_rt cookie. Mobile sends X-Client-Platform: mobile and the token in the body.',
        responses: {
          '200': { description: 'New tokens' },
          '401': errorResponse('Session expired or reused'),
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the presented refresh token',
        responses: { '204': noContent },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user, business, settings and role',
        responses: { '200': { description: 'Session' }, '401': errorResponse('Not signed in') },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change the password and revoke every session',
        responses: {
          '204': noContent,
          '401': errorResponse('Current password is wrong'),
        },
      },
    },
    '/me': {
      patch: {
        tags: ['Auth'],
        summary: 'Update own name and phone',
        responses: { '200': { description: 'Updated user' } },
      },
    },
    '/business': {
      get: {
        tags: ['Business'],
        summary: 'Business profile and settings',
        responses: { '200': { description: 'Business' } },
      },
      patch: {
        tags: ['Business'],
        summary: 'Update the business profile (owner or admin)',
        responses: {
          '200': { description: 'Updated business' },
          '403': errorResponse('Role not allowed'),
        },
      },
    },
    '/settings': {
      get: {
        tags: ['Business'],
        summary: 'Invoice and tax defaults',
        responses: { '200': { description: 'Settings' } },
      },
      put: {
        tags: ['Business'],
        summary: 'Replace settings (owner or admin)',
        responses: { '200': { description: 'Updated settings' } },
      },
    },
    '/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List customers',
        parameters: [
          ...pagingParams,
          { name: 'status', in: 'query', schema: { enum: ['active', 'archived'] } },
        ],
        responses: { '200': { description: 'Page of customers' } },
      },
      post: {
        tags: ['Customers'],
        summary: 'Create a customer',
        requestBody: jsonBody('#/components/schemas/CustomerInput'),
        responses: { '201': { description: 'Created' }, '400': errorResponse('Invalid input') },
      },
    },
    '/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Customer detail with billing stats',
        parameters: [idParam],
        responses: { '200': { description: 'Customer' }, '404': errorResponse('Not found') },
      },
      patch: {
        tags: ['Customers'],
        summary: 'Update a customer',
        parameters: [idParam],
        responses: { '200': { description: 'Updated' }, '404': errorResponse('Not found') },
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete a customer with no live invoices (owner or admin)',
        parameters: [idParam],
        responses: {
          '204': noContent,
          '409': errorResponse('Customer has invoices'),
        },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'List products',
        parameters: [
          ...pagingParams,
          { name: 'isActive', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: { '200': { description: 'Page of products' } },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a product or service',
        requestBody: jsonBody('#/components/schemas/ProductInput'),
        responses: {
          '201': { description: 'Created' },
          '409': errorResponse('SKU already used'),
        },
      },
    },
    '/invoices': {
      get: {
        tags: ['Invoices'],
        summary: 'List invoices',
        parameters: [
          ...pagingParams,
          { name: 'status', in: 'query', schema: { enum: ['draft', 'issued', 'void'] } },
          {
            name: 'paymentState',
            in: 'query',
            schema: { enum: ['unpaid', 'partial', 'paid'] },
          },
          { name: 'overdue', in: 'query', schema: { type: 'boolean' } },
          { name: 'customerId', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'Page of invoices' } },
      },
      post: {
        tags: ['Invoices'],
        summary: 'Create a draft. Totals are computed on the server.',
        requestBody: jsonBody('#/components/schemas/InvoiceInput'),
        responses: {
          '201': { description: 'Draft created' },
          '400': errorResponse('Invalid input or inactive product'),
          '404': errorResponse('Customer not found'),
        },
      },
    },
    '/invoices/{id}': {
      get: {
        tags: ['Invoices'],
        summary: 'Invoice detail with customer and payments',
        parameters: [idParam],
        responses: { '200': { description: 'Invoice' }, '404': errorResponse('Not found') },
      },
      patch: {
        tags: ['Invoices'],
        summary: 'Update a draft and recompute totals',
        parameters: [idParam],
        responses: {
          '200': { description: 'Updated draft' },
          '409': errorResponse('Invoice is not a draft'),
        },
      },
      delete: {
        tags: ['Invoices'],
        summary: 'Delete a draft (owner or admin)',
        parameters: [idParam],
        responses: { '204': noContent, '409': errorResponse('Invoice is not a draft') },
      },
    },
    '/invoices/{id}/issue': {
      post: {
        tags: ['Invoices'],
        summary: 'Assign the invoice number, snapshot details and issue',
        parameters: [idParam],
        responses: {
          '200': { description: 'Issued invoice' },
          '409': errorResponse('Already issued'),
        },
      },
    },
    '/invoices/{id}/void': {
      post: {
        tags: ['Invoices'],
        summary: 'Void an issued invoice with a reason (owner or admin)',
        parameters: [idParam],
        responses: {
          '200': { description: 'Voided invoice' },
          '409': errorResponse('Has active payments'),
        },
      },
    },
    '/invoices/{id}/duplicate': {
      post: {
        tags: ['Invoices'],
        summary: 'Copy an invoice into a new draft',
        parameters: [idParam],
        responses: { '201': { description: 'New draft' } },
      },
    },
    '/invoices/{id}/payments': {
      get: {
        tags: ['Payments'],
        summary: 'Payments recorded against an invoice',
        parameters: [idParam],
        responses: { '200': { description: 'Payments' } },
      },
      post: {
        tags: ['Payments'],
        summary: 'Record a full or partial payment',
        description:
          'Requires an Idempotency-Key header. Replaying the same key returns the original payment.',
        parameters: [
          idParam,
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', minLength: 8 },
          },
        ],
        requestBody: jsonBody('#/components/schemas/PaymentInput'),
        responses: {
          '201': { description: 'Payment recorded' },
          '200': { description: 'Payment already recorded for this key' },
          '409': errorResponse('Amount exceeds the balance'),
        },
      },
    },
    '/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List payments',
        parameters: [
          ...pagingParams,
          { name: 'invoiceId', in: 'query', schema: { type: 'string' } },
          { name: 'customerId', in: 'query', schema: { type: 'string' } },
          { name: 'method', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { enum: ['active', 'void'] } },
        ],
        responses: { '200': { description: 'Page of payments' } },
      },
    },
    '/payments/{id}/void': {
      post: {
        tags: ['Payments'],
        summary: 'Void a payment and restore the invoice balance (owner or admin)',
        parameters: [idParam],
        responses: {
          '200': { description: 'Voided payment' },
          '409': errorResponse('Already void'),
        },
      },
    },
    '/dashboard': {
      get: {
        tags: ['Reports'],
        summary: 'Counts, revenue and recent invoices for a date range',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { description: 'Dashboard' } },
      },
    },
    '/reports/summary': {
      get: {
        tags: ['Reports'],
        summary: 'Billed, collected, outstanding and tax for a range',
        responses: { '200': { description: 'Summary' } },
      },
    },
    '/reports/revenue': {
      get: {
        tags: ['Reports'],
        summary: 'Revenue by month',
        parameters: [{ name: 'groupBy', in: 'query', schema: { enum: ['month'] } }],
        responses: { '200': { description: 'Series' } },
      },
    },
    '/reports/outstanding': {
      get: {
        tags: ['Reports'],
        summary: 'Outstanding balance in aging buckets',
        parameters: [{ name: 'asOf', in: 'query', schema: { type: 'string', format: 'date' } }],
        responses: { '200': { description: 'Buckets' } },
      },
    },
    '/reports/gst': {
      get: {
        tags: ['Reports'],
        summary: 'Taxable value and CGST, SGST, IGST split by rate',
        responses: { '200': { description: 'GST summary' } },
      },
    },
    '/reports/top-customers': {
      get: {
        tags: ['Reports'],
        summary: 'Customers ranked by billed value',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 20 } }],
        responses: { '200': { description: 'Ranking' } },
      },
    },
  },
} as const;
