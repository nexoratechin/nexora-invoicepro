import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserModel } from '../models/index.js';
import { refreshCookieFlags } from '../lib/cookies.js';
import { resetLoginAttempts } from '../services/auth.service.js';
import { app, authHeader, registerAccount, uniqueEmail } from './helpers/api.js';
import { clearDatabase, connectTestDb, disconnectTestDb } from './helpers/test-db.js';

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await clearDatabase();
  resetLoginAttempts();
});

describe('POST /auth/register', () => {
  it('creates the user, business, membership and settings', async () => {
    const email = uniqueEmail('founder');

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Parth Prajapati',
        email,
        password: 'a-long-password',
        businessName: 'Nexora Technologies',
        stateCode: '24',
      })
      .expect(201);

    expect(response.body.user).toMatchObject({ name: 'Parth Prajapati', email });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.business).toMatchObject({
      name: 'Nexora Technologies',
      stateCode: '24',
      currency: 'INR',
    });
    expect(response.body.role).toBe('owner');
    expect(response.body.settings.invoicePrefix).toBe('NXP');
    expect(response.body.accessToken).toBeTypeOf('string');
  });

  it('keeps the refresh token out of the body for the web client', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Web User',
        email: uniqueEmail('web'),
        password: 'a-long-password',
        businessName: 'Web Studio',
        stateCode: '27',
      })
      .expect(201);

    expect(response.body.refreshToken).toBeUndefined();

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies?.[0]).toContain('nx_rt=');
    expect(cookies?.[0]).toContain('HttpOnly');
    expect(cookies?.[0]).toContain('SameSite=Strict');
  });

  it('returns the refresh token in the body for the mobile client', async () => {
    const session = await registerAccount();

    expect(session.refreshToken.length).toBeGreaterThan(20);
  });

  it('normalises the email to lowercase', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Case Test',
        email: 'MiXeD@Nexora.TEST',
        password: 'a-long-password',
        businessName: 'Case Studio',
        stateCode: '24',
      })
      .expect(201);

    expect(response.body.user.email).toBe('mixed@nexora.test');
  });

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail('dupe');

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'First',
        email,
        password: 'a-long-password',
        businessName: 'First Studio',
        stateCode: '24',
      })
      .expect(201);

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Second',
        email,
        password: 'a-long-password',
        businessName: 'Second Studio',
        stateCode: '24',
      })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects a short password with field details', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Short',
        email: uniqueEmail('short'),
        password: 'short',
        businessName: 'Short Studio',
        stateCode: '24',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ path: 'password' }),
    );
  });

  it('rejects an unknown GST state code', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'State Test',
        email: uniqueEmail('state'),
        password: 'a-long-password',
        businessName: 'State Studio',
        stateCode: '99',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects unknown fields instead of ignoring them', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Extra Field',
        email: uniqueEmail('extra'),
        password: 'a-long-password',
        businessName: 'Extra Studio',
        stateCode: '24',
        role: 'admin',
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('stores an argon2id hash, never the password', async () => {
    const session = await registerAccount();
    const stored = await UserModel.findOne({ email: session.email })
      .select('+passwordHash')
      .lean()
      .exec();

    expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(stored?.passwordHash).not.toContain(session.password);
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right password', async () => {
    const session = await registerAccount();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Platform', 'mobile')
      .send({ email: session.email, password: session.password })
      .expect(200);

    expect(response.body.accessToken).toBeTypeOf('string');
    expect(response.body.business.id).toBe(session.businessId);
    expect(response.body.refreshToken).toBeTypeOf('string');
  });

  it('rejects a wrong password without saying which field was wrong', async () => {
    const session = await registerAccount();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: session.email, password: 'definitely-not-it' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(response.body.error.message).toBe('Email or password is incorrect');
  });

  it('gives the same answer for an unknown email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@nexora.test', password: 'whatever-long' })
      .expect(401);

    expect(response.body.error.message).toBe('Email or password is incorrect');
  });
});

describe('GET /auth/me', () => {
  it('returns the session for a valid token', async () => {
    const session = await registerAccount();

    const response = await request(app).get('/api/v1/auth/me').set(authHeader(session)).expect(200);

    expect(response.body.user.email).toBe(session.email);
    expect(response.body.role).toBe('owner');
    expect(response.body.business.id).toBe(session.businessId);
  });

  it('rejects a request with no token', async () => {
    const response = await request(app).get('/api/v1/auth/me').expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);

    expect(response.body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the token and rejects a replay of the old one', async () => {
    const session = await registerAccount();
    const original = session.refreshToken;

    const first = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken: original })
      .expect(200);

    expect(first.body.refreshToken).not.toBe(original);
    expect(first.body.accessToken).toBeTypeOf('string');

    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken: original })
      .expect(401);

    expect(replay.body.error.code).toBe('REFRESH_REUSED');

    // Reuse revoked the whole family, so the rotated token is dead too.
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken: first.body.refreshToken })
      .expect(401);
  });

  it('rejects a refresh with no token at all', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({})
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token', async () => {
    const session = await registerAccount();

    await request(app)
      .post('/api/v1/auth/logout')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken: session.refreshToken })
      .expect(204);

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('revokes every session on logout-all', async () => {
    const session = await registerAccount();

    await request(app).post('/api/v1/auth/logout-all').set(authHeader(session)).expect(204);

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });
});

describe('POST /auth/change-password', () => {
  it('invalidates existing access tokens and requires the new password', async () => {
    const session = await registerAccount();

    await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(session))
      .send({ currentPassword: session.password, newPassword: 'a-brand-new-password' })
      .expect(204);

    await request(app).get('/api/v1/auth/me').set(authHeader(session)).expect(401);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: session.email, password: session.password })
      .expect(401);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: session.email, password: 'a-brand-new-password' })
      .expect(200);
  });

  it('rejects the wrong current password', async () => {
    const session = await registerAccount();

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set(authHeader(session))
      .send({ currentPassword: 'wrong-one', newPassword: 'a-brand-new-password' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('PATCH /me', () => {
  it('updates the profile name', async () => {
    const session = await registerAccount();

    const response = await request(app)
      .patch('/api/v1/me')
      .set(authHeader(session))
      .send({ name: 'Renamed Owner' })
      .expect(200);

    expect(response.body.user.name).toBe('Renamed Owner');
  });

  it('rejects an invalid phone number', async () => {
    const session = await registerAccount();

    await request(app)
      .patch('/api/v1/me')
      .set(authHeader(session))
      .send({ phone: 'call-me-maybe' })
      .expect(400);
  });
});

describe('refresh cookie flags', () => {
  it('is Strict in development, where app and API share a site', () => {
    const flags = refreshCookieFlags(false);

    expect(flags.sameSite).toBe('strict');
    expect(flags.secure).toBe(false);
    expect(flags.httpOnly).toBe(true);
  });

  it('is None with Secure in production, because the hosts are cross-site', () => {
    const flags = refreshCookieFlags(true);

    expect(flags.sameSite).toBe('none');
    expect(flags.secure).toBe(true);
    expect(flags.httpOnly).toBe(true);
    expect(flags.path).toBe('/api/v1/auth');
  });
});

describe('cross-site refresh guard', () => {
  it('refuses a cookie refresh from an unknown origin', async () => {
    await registerAccount();

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('allows a cookie refresh from the configured web origin', async () => {
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Web Cookie User',
        email: uniqueEmail('cookie'),
        password: 'a-long-password',
        businessName: 'Cookie Studio',
        stateCode: '24',
      })
      .expect(201);

    const setCookie = registration.headers['set-cookie']?.[0] ?? '';
    const cookie = setCookie.split(';')[0] ?? '';

    expect(cookie).toContain('nx_rt=');

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookie)
      .expect(200);

    expect(refreshed.body.accessToken).toBeTypeOf('string');
  });

  it('does not apply the origin guard to the mobile flow', async () => {
    const session = await registerAccount();

    await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('X-Client-Platform', 'mobile')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
  });
});

describe('POST /auth/forgot-password', () => {
  it('says email delivery is not configured instead of pretending', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: uniqueEmail('reset') })
      .expect(503);

    expect(response.body.error.code).toBe('MAIL_NOT_CONFIGURED');
  });
});
