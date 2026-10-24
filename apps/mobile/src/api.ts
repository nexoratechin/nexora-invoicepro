export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * Expo inlines EXPO_PUBLIC_* values at build time, so this must stay a literal
 * process.env access. On an Android emulator localhost is the emulator itself,
 * so set EXPO_PUBLIC_API_URL to http://10.0.2.2:4000/api/v1 in .env.
 */
export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export async function fetchHealth(timeoutMs = 8000): Promise<HealthResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`The API responded with ${String(response.status)}`);
    }

    return (await response.json()) as HealthResponse;
  } finally {
    clearTimeout(timeout);
  }
}
