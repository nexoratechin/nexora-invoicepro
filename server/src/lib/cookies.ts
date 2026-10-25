import type { Request, Response } from 'express';

import { allowedOrigins, env, isProduction } from '../config/env.js';

export const REFRESH_COOKIE = 'nx_rt';

/**
 * Production serves the app and the API on different registrable domains
 * (vercel.app and onrender.com), which is cross-site. A Strict cookie would
 * never be sent, so refresh would fail on every page load. None plus Secure is
 * the only combination browsers accept there, and the origin guard below is
 * what keeps it from being a CSRF hole.
 */
export function refreshCookieFlags(production: boolean) {
  return {
    httpOnly: true,
    sameSite: production ? ('none' as const) : ('strict' as const),
    secure: production,
    path: '/api/v1/auth',
  };
}

const cookieOptions = refreshCookieFlags(isProduction);

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

/**
 * Cookie authenticated requests must come from an origin we serve. A request
 * with no Origin header is a native client and is left to the token check.
 */
export function isTrustedOrigin(req: Request): boolean {
  const origin = req.header('origin');

  if (origin === undefined) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

/**
 * The mobile app cannot rely on cookies, so it sends the refresh token in the
 * body and stores it in Expo SecureStore. The header keeps the two flows apart
 * without guessing from the user agent.
 */
export function isMobileClient(req: Request): boolean {
  return req.header('x-client-platform')?.toLowerCase() === 'mobile';
}

export function readRefreshToken(req: Request): string | null {
  if (isMobileClient(req)) {
    const body: unknown = req.body;

    if (typeof body === 'object' && body !== null && 'refreshToken' in body) {
      const value = (body as { refreshToken?: unknown }).refreshToken;

      return typeof value === 'string' && value.length > 0 ? value : null;
    }

    return null;
  }

  const cookies: unknown = req.cookies;

  if (typeof cookies === 'object' && cookies !== null && REFRESH_COOKIE in cookies) {
    const value = (cookies as Record<string, unknown>)[REFRESH_COOKIE];

    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  return null;
}
