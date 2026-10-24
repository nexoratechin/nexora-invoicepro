import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

import type { InvoiceStatus, PaymentMethod, PaymentState, TaxTreatment } from '@nexora/shared';

export type Role = 'owner' | 'admin' | 'staff';

export interface ApiAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface ApiBusiness {
  id: string;
  name: string;
  gstin: string;
  stateCode: string;
  address: ApiAddress;
  phone: string;
  email: string;
}

export interface ApiSettings {
  invoicePrefix: string;
  defaultPaymentTermsDays: number;
  defaultTaxRateBp: number;
  defaultNotes: string;
  paymentInstructions: string;
  bankDetails: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    upiId: string;
  };
}

export interface Session {
  user: ApiUser;
  business: ApiBusiness;
  settings: ApiSettings | null;
  role: Role;
  accessToken: string;
}

export interface ApiCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstin: string;
  stateCode: string;
  status: 'active' | 'archived';
  billingAddress: ApiAddress;
}

export interface ApiProduct {
  id: string;
  name: string;
  unitLabel: string;
  unitPriceMinor: number;
  taxRateBp: number;
  isActive: boolean;
}

export interface ApiInvoiceLine {
  lineNo: number;
  description: string;
  unitLabel: string;
  quantityMilli: number;
  unitPriceMinor: number;
  taxRateBp: number;
  taxableMinor: number;
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

export interface ApiInvoice {
  id: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  paymentState: PaymentState;
  invoiceDate: string;
  dueDate: string;
  taxTreatment: TaxTreatment;
  placeOfSupplyStateCode: string;
  lineItems: ApiInvoiceLine[];
  totals: InvoiceTotals;
  amountPaidMinor: number;
  balanceDueMinor: number;
  customerId: string | { _id?: string; id?: string; name?: string };
  customerSnapshot: { name?: string } | null;
  notes: string;
  voidReason: string | null;
  overdue: boolean;
  events?: { type: string; message: string; createdAt: string }[];
}

export interface ApiPayment {
  id: string;
  amountMinor: number;
  paidAt: string;
  method: PaymentMethod;
  reference: string;
  status: 'active' | 'void';
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface DashboardData {
  counts: {
    total: number;
    paid: number;
    unpaid: number;
    partial: number;
    overdue: number;
    draft: number;
    void: number;
  };
  revenue: {
    billedMinor: number;
    collectedMinor: number;
    outstandingMinor: number;
    overdueMinor: number;
  };
  recentInvoices: ApiInvoice[];
  overdueInvoices: ApiInvoice[];
}

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const REFRESH_KEY = 'nexora.refreshToken';

let accessToken: string | null = null;
let refreshInFlight: Promise<Session> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed with ${String(response.status)}`;
  let code = 'UNKNOWN_ERROR';

  try {
    const body = (await response.json()) as { error?: { message?: string; code?: string } };

    if (body.error?.message !== undefined) {
      message = body.error.message;
    }
    if (body.error?.code !== undefined) {
      code = body.error.code;
    }
  } catch {
    // Keep the status based message.
  }

  return new ApiError(message, response.status, code);
}

function headers(extra: Record<string, string> = {}, withAuth = true): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Client-Platform': 'mobile',
    ...(withAuth && accessToken !== null ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extra,
  };
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  const withBody = init.body !== undefined;
  const method = init.method ?? 'GET';

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    body: init.body,
    headers: headers(withBody ? { 'Content-Type': 'application/json' } : {}),
  });
}

async function persistSession(payload: Session, refreshToken?: string): Promise<Session> {
  accessToken = payload.accessToken;

  if (refreshToken !== undefined) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }

  return payload;
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await send('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as Session & { refreshToken: string };

  return persistSession(payload, payload.refreshToken);
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  stateCode: string;
}): Promise<Session> {
  const response = await send('/auth/register', { method: 'POST', body: JSON.stringify(input) });

  if (!response.ok) {
    throw await parseError(response);
  }

  const payload = (await response.json()) as Session & { refreshToken: string };

  return persistSession(payload, payload.refreshToken);
}

/**
 * The refresh token lives in SecureStore, never in AsyncStorage, so a stolen
 * device backup or a script cannot read it as plain text.
 */
export function refreshSession(): Promise<Session> {
  if (refreshInFlight === null) {
    refreshInFlight = (async () => {
      const stored = await SecureStore.getItemAsync(REFRESH_KEY);

      if (stored === null) {
        throw new ApiError('No stored session', 401, 'NO_SESSION');
      }

      const response = await send('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: stored }),
      });

      if (!response.ok) {
        await SecureStore.deleteItemAsync(REFRESH_KEY);
        accessToken = null;
        throw await parseError(response);
      }

      const payload = (await response.json()) as Session & { refreshToken: string };

      return persistSession(payload, payload.refreshToken);
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function clearSession(): Promise<void> {
  try {
    await send('/auth/logout', { method: 'POST', body: '{}' });
  } catch {
    // Signing out locally must work even when the API is unreachable.
  }

  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);

  if (response.status === 401 && accessToken !== null && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      response = await send(path, init);
    } catch {
      accessToken = null;
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Downloads the server rendered PDF into the cache and returns its local URI,
 * ready for the share sheet. The bearer token is sent as a header, never in a
 * URL.
 */
export async function downloadInvoicePdf(invoiceId: string, filename: string): Promise<string> {
  const path = `/invoices/${invoiceId}/pdf`;
  const target = `${FileSystem.cacheDirectory ?? ''}${filename}`;

  const attempt = async (): Promise<Awaited<ReturnType<typeof FileSystem.downloadAsync>>> =>
    FileSystem.downloadAsync(`${API_BASE_URL}${path}`, target, { headers: headers() });

  let result = await attempt();

  if (result.status === 401) {
    await refreshSession();
    result = await attempt();
  }

  if (result.status !== 200) {
    throw new ApiError('The PDF could not be generated', result.status, 'PDF_FAILED');
  }

  return result.uri;
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
}

export type { DashboardData };
