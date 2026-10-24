import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import type { MembershipRole } from '@nexora/shared';

import { env, secrets } from '../config/env.js';

const ISSUER = 'nexora-invoicepro';
const accessKey = new TextEncoder().encode(secrets.access);

export interface AccessTokenClaims {
  userId: string;
  businessId: string;
  role: MembershipRole;
  tokenVersion: number;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({
    bid: claims.businessId,
    role: claims.role,
    ver: claims.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${String(env.ACCESS_TOKEN_TTL_MINUTES)}m`)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, accessKey, {
    algorithms: ['HS256'],
    issuer: ISSUER,
  });

  const { sub, bid, role, ver } = payload;

  if (typeof sub !== 'string' || typeof bid !== 'string' || typeof role !== 'string') {
    throw new Error('Access token is missing required claims');
  }

  return {
    userId: sub,
    businessId: bid,
    role: role as MembershipRole,
    tokenVersion: typeof ver === 'number' ? ver : 0,
  };
}

export function createRefreshTokenValue(): string {
  return randomBytes(32).toString('base64url');
}

/** Only the hash is stored, so a database leak does not hand over live sessions. */
export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function newFamilyId(): string {
  return randomUUID();
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
