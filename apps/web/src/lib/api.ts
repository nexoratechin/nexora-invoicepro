export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * One place for the base URL, headers and timeout. Stage 4 adds the access token
 * and the single-flight refresh to this file, so screens never build their own
 * fetch calls.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 8000, headers, ...rest } = options;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signal = rest.signal ?? timeoutController.signal;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      signal,
      headers: {
        Accept: 'application/json',
        ...(rest.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(`The API responded with ${String(response.status)}`, response.status);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health', { signal });
}
