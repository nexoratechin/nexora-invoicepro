import { Router } from 'express';

import { getAuth, requireAuth, requireRole } from '../middleware/auth.js';
import { pdfLimiter } from '../middleware/rate-limit.js';
import { objectIdSchema } from '../schemas/common.schemas.js';
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
  voidInvoiceSchema,
} from '../schemas/invoice.schemas.js';
import { recordPaymentSchema } from '../schemas/payment.schemas.js';
import * as invoiceService from '../services/invoice.service.js';
import * as paymentService from '../services/payment.service.js';
import { pdfFilename, renderInvoicePdf } from '../services/pdf.service.js';

export const invoiceRouter: Router = Router();

invoiceRouter.use(requireAuth);

invoiceRouter.get('/', async (req, res) => {
  const auth = getAuth(req);
  const query = listInvoicesQuerySchema.parse(req.query);

  res.json(await invoiceService.listInvoices(auth.businessId, query));
});

invoiceRouter.post('/', async (req, res) => {
  const auth = getAuth(req);
  const body = createInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.createDraft(auth.businessId, auth.userId, body);

  res.status(201).json({ invoice });
});

invoiceRouter.get('/:id', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  res.json(await invoiceService.getInvoice(auth.businessId, id));
});

invoiceRouter.patch('/:id', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const body = updateInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.updateDraft(auth.businessId, auth.userId, id, body);

  res.json({ invoice });
});

invoiceRouter.delete('/:id', requireRole('owner', 'admin'), async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  await invoiceService.deleteDraft(auth.businessId, id);

  res.status(204).end();
});

invoiceRouter.post('/:id/issue', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const invoice = await invoiceService.issueInvoice(auth.businessId, auth.userId, id);

  res.json({ invoice });
});

invoiceRouter.post('/:id/void', requireRole('owner', 'admin'), async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const body = voidInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.voidInvoice(auth.businessId, auth.userId, id, body.reason);

  res.json({ invoice });
});

invoiceRouter.post('/:id/duplicate', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const invoice = await invoiceService.duplicateInvoice(auth.businessId, auth.userId, id);

  res.status(201).json({ invoice });
});

invoiceRouter.get('/:id/pdf', pdfLimiter, async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const invoice = await invoiceService.getInvoiceDocument(auth.businessId, id);
  const pdf = await renderInvoicePdf(invoice);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename(invoice)}"`);
  res.setHeader('Content-Length', String(pdf.length));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(pdf);
});

invoiceRouter.get('/:id/events', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const { invoice } = await invoiceService.getInvoice(auth.businessId, id);

  res.json({ events: (invoice as { events?: unknown[] }).events ?? [] });
});

invoiceRouter.get('/:id/payments', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);

  res.json({ items: await paymentService.listInvoicePayments(auth.businessId, id) });
});

invoiceRouter.post('/:id/payments', async (req, res) => {
  const auth = getAuth(req);
  const id = objectIdSchema.parse(req.params.id);
  const body = recordPaymentSchema.parse(req.body);

  const result = await paymentService.recordPayment(
    auth.businessId,
    auth.userId,
    id,
    req.header('idempotency-key'),
    body,
  );

  res.status(result.created ? 201 : 200).json(result);
});
