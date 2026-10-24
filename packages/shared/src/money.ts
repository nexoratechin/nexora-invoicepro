/**
 * Integer money arithmetic.
 *
 * Every amount in this project is an integer number of paise, written with a
 * `Minor` suffix. No function here converts to floating point rupees for
 * calculation, and none returns a fraction. Calculations run through BigInt so
 * a large invoice cannot silently lose precision the way Number multiplication
 * would.
 */

export const PAISE_PER_RUPEE = 100;
export const QUANTITY_SCALE = 1000;
export const BASIS_POINTS_SCALE = 10_000;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

function toBigInt(value: number, label: string): bigint {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer, received ${String(value)}`);
  }
  return BigInt(value);
}

function fromBigInt(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new MoneyError(`${label} is outside the safe integer range`);
  }
  return Number(value);
}

/**
 * Divides two integers and rounds halfway cases away from zero.
 * -7 / 2 = -3.5 becomes -4. 7 / 2 becomes 4.
 */
export function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new MoneyError('Cannot divide by zero');
  }
  const negative = numerator < 0n !== denominator < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = denominator < 0n ? -denominator : denominator;

  const quotient = absNumerator / absDenominator;
  const remainder = absNumerator % absDenominator;
  const rounded = remainder * 2n >= absDenominator ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}

export function roundHalfUp(numerator: number, denominator = 1): number {
  return fromBigInt(
    roundHalfUpDiv(toBigInt(numerator, 'numerator'), toBigInt(denominator, 'denominator')),
    'result',
  );
}

/**
 * unitPriceMinor * quantityMilli / 1000, rounded to the nearest paisa.
 * Quantity is an integer count of thousandths, so 1.5 is 1500.
 */
export function multiplyByQuantity(unitPriceMinor: number, quantityMilli: number): number {
  return fromBigInt(
    roundHalfUpDiv(
      toBigInt(unitPriceMinor, 'unitPriceMinor') * toBigInt(quantityMilli, 'quantityMilli'),
      BigInt(QUANTITY_SCALE),
    ),
    'line gross',
  );
}

/**
 * Applies a rate expressed in basis points. 18% is 1800, 2.5% is 250.
 */
export function applyBasisPoints(amountMinor: number, basisPoints: number): number {
  return fromBigInt(
    roundHalfUpDiv(
      toBigInt(amountMinor, 'amountMinor') * toBigInt(basisPoints, 'basisPoints'),
      BigInt(BASIS_POINTS_SCALE),
    ),
    'basis point amount',
  );
}

/** Sums paise values and rejects a total that would overflow safe integers. */
export function sumMinor(values: readonly number[]): number {
  const total = values.reduce<bigint>((accumulator, value, index) => {
    return accumulator + toBigInt(value, `values[${String(index)}]`);
  }, 0n);

  return fromBigInt(total, 'sum');
}

/**
 * Converts a user-typed rupee amount such as "1250.50" into paise without
 * going through binary floating point. Use this for form input.
 */
export function parseRupeeAmount(input: string): number {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new MoneyError(`"${input}" is not a rupee amount with at most two decimals`);
  }

  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole = '0', fraction = '0'] = unsigned.split('.');
  const paise = Number(whole) * PAISE_PER_RUPEE + Number(fraction.padEnd(2, '0').slice(0, 2));

  return negative ? -paise : paise;
}

/** Converts paise to a rupee number. For display or charts, never for maths. */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

function groupIndianDigits(digits: string): string {
  if (digits.length <= 3) {
    return digits;
  }

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);

  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
}

/**
 * Formats paise as Indian-grouped rupees with two decimals: 1234567890 becomes
 * "₹12,34,567.89". Grouping is done on the digit string, so it does not depend
 * on the runtime's Intl data being present (Hermes on Android included).
 */
export function formatPaise(paise: number, options: { symbol?: string } = {}): string {
  const symbol = options.symbol ?? '₹';
  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / PAISE_PER_RUPEE);
  const fraction = absolute % PAISE_PER_RUPEE;

  const body = `${groupIndianDigits(String(rupees))}.${String(fraction).padStart(2, '0')}`;

  return `${negative ? '-' : ''}${symbol}${body}`;
}

/** Same as formatPaise without the currency symbol, for PDF tables. */
export function formatPaisePlain(paise: number): string {
  return formatPaise(paise, { symbol: '' });
}
