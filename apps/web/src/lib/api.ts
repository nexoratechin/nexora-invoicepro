export type Role = 'owner' | 'admin' | 'staff';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface ApiAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface ApiBusiness {
  id: string;
  name: string;
  legalName: string;
  gstin: string;
  stateCode: string;
  address: ApiAddress;
  phone: string;
  email: string;
  website: string;
  currency: string;
}

export interface ApiBankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId: string;
}

export interface ApiSettings {
  id: string;
  invoicePrefix: string;
  numberSeries: string;
  defaultPaymentTermsDays: number;
  defaultTaxRateBp: number;
  defaultNotes: string;
  paymentInstructions: string;
  bankDetails: ApiBankDetails;
  taxInclusivePricing: boolean;
}

export interface SessionPayload {
  user: ApiUser;
  business: ApiBusiness;
  settings: ApiSettings | null;
  role: Role;
  accessToken: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * The access token lives in memory only. A page reload calls refreshSession and
 * the httpOnly cookie restores the session, so no token is ever readable from
 * localStorage by a script.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: { error?: ApiErrorBody } | null;

  try {
    body = (await response.json()) as { error?: ApiErrorBody };
  } catch {
    body = null;
  }

  const error = body?.error;

  return new ApiError(
    error?.message ?? `The request failed with status ${String(response.status)}`,
    response.status,
    error?.code ?? 'UNKNOWN_ERROR',
    error?.details,
  );
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken === null ? {} : { Authorization: `Bearer ${accessToken}` }),
      ...init.headers,
    },
  });
}

let refreshInFlight: Promise<SessionPayload> | null = null;

/**
 * Single flight: ten parallel 401s share one refresh, so the server never sees a
 * rotation race from a single tab.
 */
export function refreshSession(): Promise<SessionPayload> {
  if (refreshInFlight === null) {
    refreshInFlight = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{}',
      });

      if (!response.ok) {
        accessToken = null;
        throw await toApiError(response);
      }

      const payload = (await response.json()) as SessionPayload;
      accessToken = payload.accessToken;

      return payload;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function loginRequest(email: string, password: string): Promise<SessionPayload> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  const payload = (await response.json()) as SessionPayload;
  accessToken = payload.accessToken;

  return payload;
}

export async function registerRequest(input: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  stateCode: string;
}): Promise<SessionPayload> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  const payload = (await response.json()) as SessionPayload;
  accessToken = payload.accessToken;

  return payload;
}

/**
 * Fetches the PDF with the bearer token and hands the browser a blob. The token
 * never appears in a URL, and a 401 goes through the same refresh as the rest.
 */
export async function downloadInvoicePdf(invoiceId: string, filename: string): Promise<void> {
  const path = `/invoices/${invoiceId}/pdf`;
  let response = await send(path);

  if (response.status === 401 && accessToken !== null) {
    try {
      await refreshSession();
      response = await send(path);
    } catch {
      accessToken = null;
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function logoutRequest(): Promise<void> {
  try {
    await send('/auth/logout', { method: 'POST', body: '{}' });
  } finally {
    accessToken = null;
  }
}

/** Turns an unknown thrown value into text a person can read. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong';
}

export function validationMessages(error: unknown): string[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) {
    return [];
  }

  return error.details
    .map((detail) =>
      typeof detail === 'object' && detail !== null && 'message' in detail
        ? String((detail as { message: unknown }).message)
        : null,
    )
    .filter((value): value is string => value !== null);
}
