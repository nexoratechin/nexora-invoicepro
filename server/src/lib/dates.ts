import { DEFAULT_TIME_ZONE } from '@nexora/shared';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Invoice dates are calendar dates, not instants. They are stored at UTC
 * midnight and compared as UTC, so no time zone can shift a due date by a day.
 */
export function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) {
    throw new RangeError(`"${value}" is not a YYYY-MM-DD date`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(value)) {
    throw new RangeError(`"${value}" is not a real calendar date`);
  }

  return date;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today in the business time zone, as YYYY-MM-DD. */
export function todayIso(timeZone: string = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

export function addDaysIso(value: string, days: number): string {
  const date = parseIsoDate(value);

  date.setUTCDate(date.getUTCDate() + days);

  return toIsoDate(date);
}

/** Indian fiscal year label for a date, running April to March. */
export function fiscalYearFor(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const startYear = month >= 3 ? year : year - 1;

  return `${String(startYear)}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}
