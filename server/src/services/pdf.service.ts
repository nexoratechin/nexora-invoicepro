import { fileURLToPath } from 'node:url';

import { formatPaise, formatPaisePlain } from '@nexora/shared';
import PDFDocument from 'pdfkit';

import type { InvoiceDocument } from '../models/invoice.model.js';
import { cleanText, rupeesInWords, safeFilename } from '../lib/text.js';

const FONT_REGULAR = fileURLToPath(
  new URL('../../assets/fonts/NotoSans-Regular.ttf', import.meta.url),
);
const FONT_BOLD = fileURLToPath(new URL('../../assets/fonts/NotoSans-Bold.ttf', import.meta.url));

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_BAND = 78;

const COLOR = {
  navy: '#0A1B35',
  blue: '#0066FF',
  cyan: '#00D4FF',
  muted: '#4A5C78',
  faint: '#8794A8',
  line: '#DCE3EC',
  red: '#B91C1C',
  soft: '#F4F7FC',
} as const;

/** Column widths that add up to the content width. */
const COLUMNS = [
  { key: 'lineNo', width: 22, align: 'left' as const },
  { key: 'description', width: 230, align: 'left' as const },
  { key: 'hsnSac', width: 50, align: 'left' as const },
  { key: 'quantity', width: 48, align: 'right' as const },
  { key: 'rate', width: 62, align: 'right' as const },
  { key: 'tax', width: 40, align: 'right' as const },
  { key: 'amount', width: 55, align: 'right' as const },
];

function statusLabel(invoice: InvoiceDocument): { text: string; color: string } {
  if (invoice.status === 'draft') return { text: 'DRAFT', color: COLOR.muted };
  if (invoice.status === 'void') return { text: 'VOID', color: COLOR.red };

  const overdue = invoice.balanceDueMinor > 0 && invoice.dueDate.getTime() < Date.now();

  if (invoice.paymentState === 'paid') return { text: 'PAID', color: '#047857' };
  if (invoice.paymentState === 'partial') return { text: 'PART PAID', color: '#B45309' };
  if (overdue) return { text: 'OVERDUE', color: COLOR.red };

  return { text: 'UNPAID', color: '#B45309' };
}

export function pdfFilename(invoice: InvoiceDocument): string {
  return `${safeFilename(invoice.invoiceNumber ?? 'draft-invoice')}.pdf`;
}

/**
 * Renders the invoice from the stored document, never from client input. Text is
 * cleaned, all money comes from the persisted integer paise, and the layout
 * breaks pages without clipping a line.
 */
export async function renderInvoicePdf(invoice: InvoiceDocument): Promise<Buffer> {
  const snapshot = invoice.businessSnapshot;
  const customer = invoice.customerSnapshot;
  const status = statusLabel(invoice);

  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: {
      Title: `Invoice ${invoice.invoiceNumber ?? 'draft'}`,
      Author: cleanText(snapshot?.name ?? 'Nexora InvoicePro', 80),
      Subject: `Tax invoice for ${cleanText(customer?.name ?? 'customer', 80)}`,
      Creator: 'Nexora InvoicePro',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });

  doc.registerFont('body', FONT_REGULAR);
  doc.registerFont('bold', FONT_BOLD);
  doc.font('body');

  drawWatermark(doc, invoice);
  drawHeader(doc, invoice, status);
  let y = drawParties(doc, invoice);
  y = drawItems(doc, invoice, y);
  y = drawTotals(doc, invoice, y);
  drawPaymentDetails(doc, invoice, y);
  drawFooters(doc);

  doc.end();

  return finished;
}

function drawWatermark(doc: PDFKit.PDFDocument, invoice: InvoiceDocument): void {
  const label = invoice.status === 'void' ? 'VOID' : invoice.status === 'draft' ? 'DRAFT' : null;

  if (label === null) {
    return;
  }

  doc.save();
  doc.rotate(-35, { origin: [PAGE_WIDTH / 2, PAGE_HEIGHT / 2] });
  doc
    .font('bold')
    .fontSize(120)
    .fillColor(invoice.status === 'void' ? COLOR.red : COLOR.faint)
    .opacity(0.09)
    .text(label, 0, PAGE_HEIGHT / 2 - 60, { width: PAGE_WIDTH, align: 'center' });
  doc.opacity(1);
  doc.restore();
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  invoice: InvoiceDocument,
  status: { text: string; color: string },
): void {
  doc.rect(0, 0, PAGE_WIDTH, 104).fill(COLOR.navy);
  doc.rect(0, 104, PAGE_WIDTH, 3).fill(COLOR.cyan);

  doc
    .font('bold')
    .fontSize(19)
    .fillColor('#FFFFFF')
    .text(cleanText(invoice.businessSnapshot?.name ?? 'Nexora Technologies', 120), MARGIN, 30, {
      width: 300,
    });

  const gstin = cleanText(invoice.businessSnapshot?.gstin ?? '', 20);
  doc
    .font('body')
    .fontSize(8.5)
    .fillColor('#B9C6DA')
    .text(gstin === '' ? 'GSTIN not set' : `GSTIN ${gstin}`, MARGIN, 53, { width: 300 });

  const placeOfSupply = cleanText(invoice.placeOfSupplyStateCode, 4);
  doc.text(`Place of supply ${placeOfSupply}`, MARGIN, 66, { width: 300 });

  doc
    .font('bold')
    .fontSize(15)
    .fillColor('#FFFFFF')
    .text('TAX INVOICE', 0, 30, { width: PAGE_WIDTH - MARGIN, align: 'right' });

  doc
    .font('body')
    .fontSize(9)
    .fillColor('#B9C6DA')
    .text(cleanText(invoice.invoiceNumber ?? 'Not issued', 40), 0, 52, {
      width: PAGE_WIDTH - MARGIN,
      align: 'right',
    });

  doc
    .font('bold')
    .fontSize(8.5)
    .fillColor(status.color)
    .text(status.text, 0, 68, { width: PAGE_WIDTH - MARGIN, align: 'right' });
}

function drawParties(doc: PDFKit.PDFDocument, invoice: InvoiceDocument): number {
  const top = 128;
  const columnWidth = CONTENT_WIDTH / 3 - 12;
  const customer = invoice.customerSnapshot;
  const business = invoice.businessSnapshot;

  doc.font('bold').fontSize(7.5).fillColor(COLOR.faint).text('FROM', MARGIN, top);
  doc.font('body').fontSize(9).fillColor(COLOR.navy);
  const address = business?.address ?? {};
  const fromLines = [
    cleanText(business?.name ?? '', 80),
    [address.line1, address.line2].filter((part) => part !== undefined && part !== '').join(', '),
    [address.city, address.state, address.pincode]
      .filter((part) => part !== undefined && part !== '')
      .join(', '),
    business?.phone !== undefined && business.phone !== '' ? cleanText(business.phone, 24) : '',
    business?.email !== undefined && business.email !== '' ? cleanText(business.email, 80) : '',
  ].filter((line) => line !== '');
  doc.text(fromLines.join('\n'), MARGIN, top + 13, { width: columnWidth, lineGap: 1.5 });

  const billedX = MARGIN + CONTENT_WIDTH / 3;
  const billedAddress = customer?.billingAddress ?? {};
  doc.font('bold').fontSize(7.5).fillColor(COLOR.faint).text('BILLED TO', billedX, top);
  doc.font('body').fontSize(9).fillColor(COLOR.navy);
  const toLines = [
    cleanText(customer?.name ?? 'Customer', 80),
    customer?.gstin !== undefined && customer.gstin !== ''
      ? `GSTIN ${cleanText(customer.gstin, 20)}`
      : '',
    [billedAddress.line1, billedAddress.line2]
      .filter((part) => part !== undefined && part !== '')
      .join(', '),
    [billedAddress.city, billedAddress.state, billedAddress.pincode]
      .filter((part) => part !== undefined && part !== '')
      .join(', '),
  ].filter((line) => line !== '');
  doc.text(toLines.join('\n'), billedX, top + 13, { width: columnWidth, lineGap: 1.5 });

  const metaX = MARGIN + (CONTENT_WIDTH / 3) * 2;
  doc.font('bold').fontSize(7.5).fillColor(COLOR.faint).text('DETAILS', metaX, top);

  const meta: [string, string][] = [
    ['Invoice date', invoice.invoiceDate.toISOString().slice(0, 10)],
    ['Due date', invoice.dueDate.toISOString().slice(0, 10)],
    ['Currency', 'INR'],
  ];

  let metaY = top + 13;

  for (const [label, value] of meta) {
    doc.font('body').fontSize(8).fillColor(COLOR.muted).text(label, metaX, metaY, { width: 70 });
    doc
      .font('bold')
      .fontSize(8)
      .fillColor(COLOR.navy)
      .text(value, metaX + 72, metaY, { width: 90, align: 'right' });
    metaY += 12;
  }

  return Math.max(metaY, top + 13 + fromLines.length * 11, top + 13 + toLines.length * 11) + 18;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number): number {
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(COLOR.navy);

  let x = MARGIN;

  const titles: Record<string, string> = {
    lineNo: '#',
    description: 'DESCRIPTION',
    hsnSac: 'HSN',
    quantity: 'QTY',
    rate: 'RATE',
    tax: 'GST',
    amount: 'AMOUNT',
  };

  doc.font('bold').fontSize(7.5).fillColor('#FFFFFF');

  for (const column of COLUMNS) {
    doc.text(titles[column.key] ?? '', x + 5, y + 6.5, {
      width: column.width - 10,
      align: column.align,
    });
    x += column.width;
  }

  return y + 20;
}

function drawItems(doc: PDFKit.PDFDocument, invoice: InvoiceDocument, startY: number): number {
  let y = drawTableHeader(doc, startY);
  const bottomLimit = PAGE_HEIGHT - FOOTER_BAND;

  for (const line of invoice.lineItems) {
    const description = cleanText(line.description, 400);
    doc.font('body').fontSize(8.5);
    const descriptionHeight = doc.heightOfString(description, { width: COLUMNS[1]?.width ?? 230 });
    const rowHeight = Math.max(20, descriptionHeight + 10);

    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawTableHeader(doc, MARGIN);
    }

    let x = MARGIN;
    doc.font('body').fontSize(8.5).fillColor(COLOR.navy);

    const cells: Record<string, string> = {
      lineNo: String(line.lineNo),
      description,
      hsnSac: cleanText(line.hsnSac, 12) === '' ? '-' : cleanText(line.hsnSac, 12),
      quantity: String(line.quantityMilli / 1000),
      rate: formatPaisePlain(line.unitPriceMinor),
      tax: `${String(line.taxRateBp / 100)}%`,
      amount: formatPaisePlain(line.lineTotalMinor),
    };

    for (const column of COLUMNS) {
      doc.text(cells[column.key] ?? '', x + 5, y + 6, {
        width: column.width - 10,
        align: column.align,
      });
      x += column.width;
    }

    y += rowHeight;
    doc
      .moveTo(MARGIN, y)
      .lineTo(MARGIN + CONTENT_WIDTH, y)
      .lineWidth(0.5)
      .strokeColor(COLOR.line)
      .stroke();
  }

  return y + 14;
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: InvoiceDocument, startY: number): number {
  const totals = invoice.totals;
  const labelX = MARGIN + CONTENT_WIDTH - 230;
  const valueX = MARGIN + CONTENT_WIDTH - 100;
  let y = startY;

  const rows: [string, string][] = [
    ['Subtotal', formatPaise(totals.subtotalMinor)],
    ['Discount', `-${formatPaise(totals.discountTotalMinor)}`],
    ['Taxable value', formatPaise(totals.taxableTotalMinor)],
  ];

  if (invoice.taxTreatment === 'intra') {
    rows.push(['CGST', formatPaise(totals.cgstTotalMinor)]);
    rows.push(['SGST', formatPaise(totals.sgstTotalMinor)]);
  } else {
    rows.push(['IGST', formatPaise(totals.igstTotalMinor)]);
  }

  for (const [label, value] of rows) {
    doc.font('body').fontSize(9).fillColor(COLOR.muted).text(label, labelX, y, { width: 130 });
    doc
      .font('body')
      .fontSize(9)
      .fillColor(COLOR.navy)
      .text(value, valueX, y, { width: 100, align: 'right' });
    y += 14;
  }

  doc
    .moveTo(labelX, y + 2)
    .lineTo(MARGIN + CONTENT_WIDTH, y + 2)
    .lineWidth(0.8)
    .strokeColor(COLOR.line)
    .stroke();

  doc
    .font('bold')
    .fontSize(12)
    .fillColor(COLOR.navy)
    .text('Total', labelX, y + 10, { width: 130 });
  doc
    .font('bold')
    .fontSize(12)
    .fillColor(COLOR.navy)
    .text(formatPaise(totals.totalMinor), valueX, y + 10, { width: 100, align: 'right' });

  doc
    .font('body')
    .fontSize(9)
    .fillColor(COLOR.muted)
    .text('Amount paid', labelX, y + 30, { width: 130 });
  doc
    .font('body')
    .fontSize(9)
    .fillColor(COLOR.navy)
    .text(formatPaise(invoice.amountPaidMinor), valueX, y + 30, { width: 100, align: 'right' });

  doc
    .font('bold')
    .fontSize(9)
    .fillColor(COLOR.navy)
    .text('Balance due', labelX, y + 44, { width: 130 });
  doc
    .font('bold')
    .fontSize(9)
    .fillColor(COLOR.navy)
    .text(formatPaise(invoice.balanceDueMinor), valueX, y + 44, { width: 100, align: 'right' });

  const words = rupeesInWords(totals.totalMinor);
  doc
    .font('body')
    .fontSize(8)
    .fillColor(COLOR.muted)
    .text(`Amount in words: ${cleanText(words, 200)}`, MARGIN, y + 10, {
      width: CONTENT_WIDTH - 250,
    });

  return y + 66;
}

function drawPaymentDetails(
  doc: PDFKit.PDFDocument,
  invoice: InvoiceDocument,
  startY: number,
): void {
  let y = startY;
  const bank = invoice.businessSnapshot?.bankDetails ?? {};
  const terms = cleanText(invoice.terms, 600);
  const notes = cleanText(invoice.notes, 600);

  const bankLines = [
    bank.accountName !== undefined && bank.accountName !== ''
      ? `Account: ${cleanText(bank.accountName, 80)}`
      : '',
    bank.accountNumber !== undefined && bank.accountNumber !== ''
      ? `A/C no: ${cleanText(bank.accountNumber, 30)}`
      : '',
    bank.ifsc !== undefined && bank.ifsc !== '' ? `IFSC: ${cleanText(bank.ifsc, 12)}` : '',
    bank.upiId !== undefined && bank.upiId !== '' ? `UPI: ${cleanText(bank.upiId, 60)}` : '',
  ].filter((line) => line !== '');

  const blocks: [string, string][] = [];

  if (bankLines.length > 0) {
    blocks.push(['PAYMENT DETAILS', bankLines.join('\n')]);
  }

  if (terms !== '') {
    blocks.push(['TERMS', terms]);
  }

  if (notes !== '') {
    blocks.push(['NOTES', notes]);
  }

  for (const [heading, body] of blocks) {
    if (y > PAGE_HEIGHT - FOOTER_BAND - 80) {
      doc.addPage();
      y = MARGIN;
    }

    doc.font('bold').fontSize(7.5).fillColor(COLOR.faint).text(heading, MARGIN, y);
    doc
      .font('body')
      .fontSize(8.5)
      .fillColor(COLOR.navy)
      .text(body, MARGIN, y + 11, {
        width: CONTENT_WIDTH,
        lineGap: 2,
      });

    y = doc.y + 10;
  }
}

function drawFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  const disclaimer =
    'Software generated invoice. Tax figures are software calculations, not tax advice.';

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);

    // Footer content sits inside the bottom margin, and pdfkit paginates any
    // text that lands there unless the margin is removed for the draw.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = PAGE_HEIGHT - 40;

    doc
      .moveTo(MARGIN, y - 6)
      .lineTo(MARGIN + CONTENT_WIDTH, y - 6)
      .lineWidth(0.5)
      .strokeColor(COLOR.line)
      .stroke();

    doc
      .font('body')
      .fontSize(7)
      .fillColor(COLOR.faint)
      .text(disclaimer, MARGIN, y, {
        width: CONTENT_WIDTH - 80,
      });

    doc
      .font('body')
      .fontSize(7)
      .fillColor(COLOR.faint)
      .text(`Page ${String(index + 1)} of ${String(range.count)}`, 0, y, {
        width: PAGE_WIDTH - MARGIN,
        align: 'right',
      });

    doc.page.margins.bottom = bottomMargin;
  }
}
