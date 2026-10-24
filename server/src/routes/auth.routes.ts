import { type Request, Router } from 'express';

import {
  clearRefreshCookie,
  isMobileClient,
  readRefreshToken,
  setRefreshCookie,
} from '../lib/cookies.js';
import { AppError, unauthenticated } from '../lib/errors.js';
import { getAuth, requireAuth } from '../middleware/auth.js';
import { loginLimiter, registerLimiter, sensitiveLimiter } from '../middleware/rate-limit.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from '../schemas/auth.schemas.js';
import * as authService from '../services/auth.service.js';

export const authRouter: Router = Router();

function clientContext(req: Request): authService.ClientContext {
  return {
    userAgent: req.header('user-agent') ?? '',
    ip: req.ip ?? '',
  };
}

function sessionPayload(result: authService.AuthResult, includeRefreshToken: boolean) {
  return {
    user: result.user.toJSON(),
    business: result.business.toJSON(),
    settings: result.settings.toJSON(),
    role: result.membership.role,
    accessToken: result.accessToken,
    ...(includeRefreshToken ? { refreshToken: result.refreshToken } : {}),
  };
}

authRouter.post('/register', registerLimiter, async (req, res) => {
  const body = registerSchema.parse(req.body);
  const result = await authService.registerUser(body, clientContext(req));

  setRefreshCookie(res, result.refreshToken);
  res.status(201).json(sessionPayload(result, isMobileClient(req)));
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const body = loginSchema.parse(req.body);
  const result = await authService.loginUser(body, clientContext(req));

  setRefreshCookie(res, result.refreshToken);
  res.json(sessionPayload(result, isMobileClient(req)));
});

authRouter.post('/refresh', async (req, res) => {
  if (isMobileClient(req)) {
    refreshSchema.parse(req.body);
  }

  const rawToken = readRefreshToken(req);

  if (rawToken === null) {
    throw unauthenticated('No refresh token was sent');
  }

  const result = await authService.rotateRefreshToken(rawToken, clientContext(req));

  setRefreshCookie(res, result.refreshToken);
  res.json(sessionPayload(result, isMobileClient(req)));
});

authRouter.post('/logout', async (req, res) => {
  const rawToken = readRefreshToken(req);

  if (rawToken !== null) {
    await authService.revokeRefreshToken(rawToken);
  }

  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const auth = getAuth(req);

  await authService.revokeAllSessions(auth.userId);
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const session = await authService.currentSession(auth.userId, auth.businessId);

  res.json({
    user: session.user.toJSON(),
    business: session.business.toJSON(),
    settings: session.settings === null ? null : session.settings.toJSON(),
    role: auth.role,
  });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const auth = getAuth(req);
  const body = changePasswordSchema.parse(req.body);

  await authService.changePassword(auth.userId, body.currentPassword, body.newPassword);
  clearRefreshCookie(res);
  res.status(204).end();
});

/**
 * Password reset needs a verified sending domain. Until SMTP is configured the
 * endpoint says so instead of pretending an email was sent.
 */
authRouter.post('/forgot-password', sensitiveLimiter, (req, _res) => {
  forgotPasswordSchema.parse(req.body);

  throw new AppError(
    503,
    'MAIL_NOT_CONFIGURED',
    'Password reset by email is not available yet. Ask an owner to reset it.',
  );
});
