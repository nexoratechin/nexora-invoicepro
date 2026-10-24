import { formatPaise, PAISE_PER_RUPEE } from '@nexora/shared';

export const money = formatPaise;

/** Rupees for a form input, for example 2500000 paise becomes "25000.00". */
export function toRupeeInput(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const absolute = Math.abs(paise);
  const rupees = Math.trunc(absolute / PAISE_PER_RUPEE);
  const fraction = absolute % PAISE_PER_RUPEE;

  return `${sign}${String(rupees)}.${String(fraction).padStart(2, '0')}`;
}

/** Quantity in thousandths to a short decimal string: 1500 becomes "1.5". */
export function toQuantityInput(quantityMilli: number): string {
  const whole = Math.trunc(quantityMilli / 1000);
  const fraction = String(quantityMilli % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');

  return fraction.length > 0 ? `${String(whole)}.${fraction}` : String(whole);
}

export function formatDate(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }

  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'Not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

/** Today in the business time zone, as the YYYY-MM-DD a date input wants. */
export function todayIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '01';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function monthStartIso(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

export function percent(basisPoints: number): string {
  return `${String(basisPoints / 100)}%`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
