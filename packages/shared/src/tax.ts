import {
  applyBasisPoints,
  MoneyError,
  multiplyByQuantity,
  roundHalfUp,
  sumMinor,
} from './money.js';

export type TaxTreatment = 'intra' | 'inter';

export interface LineItemInput {
  description: string;
  quantityMilli: number;
  unitPriceMinor: number;
  taxRateBp: number;
  discountBp?: number;
  hsnSac?: string;
  unitLabel?: string;
  productId?: string | null;
}

export interface ComputedLineItem {
  lineNo: number;
  productId: string | null;
  description: string;
  hsnSac: string;
  unitLabel: string;
  quantityMilli: number;
  unitPriceMinor: number;
  discountBp: number;
  grossMinor: number;
  discountMinor: number;
  taxableMinor: number;
  taxRateBp: number;
  taxTreatment: TaxTreatment;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  taxMinor: number;
  lineTotalMinor: number;
}

export interface InvoiceTotals {
  subtotalMinor: number;
  discountTotalMinor: number;
  taxableTotalMinor: number;
  cgstTotalMinor: number;
  sgstTotalMinor: number;
  igstTotalMinor: number;
  taxTotalMinor: number;
  roundOffMinor: number;
  totalMinor: number;
}

/**
 * Same state as the business means CGST plus SGST. A different state means
 * IGST. Exports are treated as inter-state, which is the usual default for a
 * place of supply outside the business state.
 */
export function resolveTaxTreatment(
  businessStateCode: string,
  placeOfSupplyStateCode: string,
): TaxTreatment {
  return businessStateCode === placeOfSupplyStateCode ? 'intra' : 'inter';
}

function assertRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new MoneyError(`${label} must be an integer between ${min} and ${max}`);
  }
}

export function computeLineItem(
  input: LineItemInput,
  taxTreatment: TaxTreatment,
  lineNo = 1,
): ComputedLineItem {
  const discountBp = input.discountBp ?? 0;

  assertRange(input.unitPriceMinor, 0, 100_000_000_000, 'unitPriceMinor');
  assertRange(input.quantityMilli, 1, 1_000_000, 'quantityMilli');
  assertRange(input.taxRateBp, 0, 10_000, 'taxRateBp');
  assertRange(discountBp, 0, 10_000, 'discountBp');

  if (input.description.trim().length === 0) {
    throw new MoneyError(`Line ${lineNo} needs a description`);
  }

  const grossMinor = multiplyByQuantity(input.unitPriceMinor, input.quantityMilli);
  const discountMinor = Math.min(applyBasisPoints(grossMinor, discountBp), grossMinor);
  const taxableMinor = grossMinor - discountMinor;
  const taxMinor = applyBasisPoints(taxableMinor, input.taxRateBp);

  // Splitting with a rounded half and a remainder means the two halves always
  // add back to the line tax, even when the tax is an odd number of paise.
  const cgstMinor = taxTreatment === 'intra' ? roundHalfUp(taxMinor, 2) : 0;
  const sgstMinor = taxTreatment === 'intra' ? taxMinor - cgstMinor : 0;
  const igstMinor = taxTreatment === 'inter' ? taxMinor : 0;

  return {
    lineNo,
    productId: input.productId ?? null,
    description: input.description.trim(),
    hsnSac: input.hsnSac?.trim() ?? '',
    unitLabel: input.unitLabel?.trim() ?? 'unit',
    quantityMilli: input.quantityMilli,
    unitPriceMinor: input.unitPriceMinor,
    discountBp,
    grossMinor,
    discountMinor,
    taxableMinor,
    taxRateBp: input.taxRateBp,
    taxTreatment,
    cgstMinor,
    sgstMinor,
    igstMinor,
    taxMinor,
    lineTotalMinor: taxableMinor + taxMinor,
  };
}

/**
 * Totals are sums of line values that have already been rounded, so the lines
 * always add up to the invoice total. Nothing is rounded here.
 */
export function computeInvoiceTotals(lines: readonly ComputedLineItem[]): InvoiceTotals {
  const subtotalMinor = sumMinor(lines.map((line) => line.grossMinor));
  const discountTotalMinor = sumMinor(lines.map((line) => line.discountMinor));
  const taxableTotalMinor = sumMinor(lines.map((line) => line.taxableMinor));
  const cgstTotalMinor = sumMinor(lines.map((line) => line.cgstMinor));
  const sgstTotalMinor = sumMinor(lines.map((line) => line.sgstMinor));
  const igstTotalMinor = sumMinor(lines.map((line) => line.igstMinor));
  const taxTotalMinor = sumMinor(lines.map((line) => line.taxMinor));

  const computedTotal = taxableTotalMinor + taxTotalMinor;
  const roundOffMinor = 0;

  if (computedTotal !== subtotalMinor - discountTotalMinor + taxTotalMinor) {
    throw new MoneyError('Invoice totals do not reconcile with the line items');
  }

  return {
    subtotalMinor,
    discountTotalMinor,
    taxableTotalMinor,
    cgstTotalMinor,
    sgstTotalMinor,
    igstTotalMinor,
    taxTotalMinor,
    roundOffMinor,
    totalMinor: computedTotal + roundOffMinor,
  };
}

export function computeInvoice(
  inputs: readonly LineItemInput[],
  taxTreatment: TaxTreatment,
): { lines: ComputedLineItem[]; totals: InvoiceTotals } {
  if (inputs.length === 0) {
    throw new MoneyError('An invoice needs at least one line item');
  }

  const lines = inputs.map((input, index) => computeLineItem(input, taxTreatment, index + 1));

  return { lines, totals: computeInvoiceTotals(lines) };
}
