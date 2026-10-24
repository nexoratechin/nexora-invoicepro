/**
 * User text reaches a PDF, so it is normalised before it is drawn. pdfkit does
 * not interpret markup, and this removes the control characters that could
 * break a line box or a filename.
 */
export function cleanText(value: string | null | undefined, maxLength = 500): string {
  if (value === null || value === undefined) {
    return '';
  }

  return (
    value
      .replace(/\r\n/g, '\n')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim()
      .slice(0, maxLength)
  );
}

/** Anything used in a Content-Disposition filename must be boring. */
export function safeFilename(value: string, fallback = 'invoice'): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);

  return cleaned.length === 0 ? fallback : cleaned;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underHundred(value: number): string {
  if (value < 20) {
    return ONES[value] ?? '';
  }

  const tens = TENS[Math.floor(value / 10)] ?? '';
  const ones = ONES[value % 10] ?? '';

  return ones === '' ? tens : `${tens} ${ones}`;
}

function underThousand(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts: string[] = [];

  if (hundreds > 0) {
    parts.push(`${ONES[hundreds] ?? ''} Hundred`);
  }

  if (rest > 0) {
    parts.push(underHundred(rest));
  }

  return parts.join(' ');
}

/** Indian grouping: crore, lakh, thousand, hundred. 7080000 becomes "Seventy Lakh Eighty Thousand". */
export function rupeesInWords(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('amountMinor must be an integer number of paise');
  }

  if (amountMinor < 0) {
    return `Minus ${rupeesInWords(-amountMinor)}`;
  }

  const rupees = Math.floor(amountMinor / 100);
  const paise = amountMinor % 100;

  if (rupees === 0 && paise === 0) {
    return 'Zero Rupees Only';
  }

  const parts: string[] = [];
  let remaining = rupees;

  const crore = Math.floor(remaining / 10_000_000);
  remaining %= 10_000_000;
  const lakh = Math.floor(remaining / 100_000);
  remaining %= 100_000;
  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;

  if (crore > 0) parts.push(`${underThousand(crore)} Crore`);
  if (lakh > 0) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${underThousand(thousand)} Thousand`);
  if (remaining > 0) parts.push(underThousand(remaining));

  const rupeesPart = parts.length === 0 ? '' : `${parts.join(' ')} Rupees`;
  const paisePart = paise === 0 ? '' : `${underHundred(paise)} Paise`;

  return `${[rupeesPart, paisePart].filter((part) => part !== '').join(' and ')} Only`;
}
