import { type Request, type RequestHandler } from 'express';
import type { Types } from 'mongoose';

import type { MembershipRole } from '@nexora/shared';

import { MembershipModel, UserModel } from '../models/index.js';
import { AppError, forbiddenRole, unauthenticated } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

export interface AuthContext {
  userId: Types.ObjectId;
  businessId: Types.ObjectId;
  membershipId: Types.ObjectId;
  role: MembershipRole;
}

export function getAuth(req: Request): AuthContext {
  if (req.auth === undefined) {
    throw unauthenticated();
  }

  return req.auth;
}

/**
 * The business id and role come from the signed token, never from the request.
 * The membership is re-read on every request so revoking access takes effect
 * within one access token lifetime.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');

  if (header === undefined || !header.startsWith('Bearer ')) {
    throw unauthenticated('Send an Authorization: Bearer token');
  }

  let claims;

  try {
    claims = await verifyAccessToken(header.slice('Bearer '.length).trim());
  } catch {
    throw new AppError(401, 'TOKEN_EXPIRED', 'The access token is invalid or has expired');
  }

  const [membership, user] = await Promise.all([
    MembershipModel.findOne({
      userId: claims.userId,
      businessId: claims.businessId,
      status: 'active',
    }).exec(),
    UserModel.findById(claims.userId).select('tokenVersion').exec(),
  ]);

  if (membership === null) {
    throw unauthenticated('This membership is no longer active');
  }

  if (user === null || user.tokenVersion !== claims.tokenVersion) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'The session was revoked. Sign in again.');
  }

  req.auth = {
    userId: membership.userId,
    businessId: membership.businessId,
    membershipId: membership._id,
    role: membership.role,
  };

  next();
};

export function requireRole(...roles: MembershipRole[]): RequestHandler {
  return (req, _res, next) => {
    const auth = getAuth(req);

    if (!roles.includes(auth.role)) {
      throw forbiddenRole(`Only ${roles.join(' or ')} can do this`);
    }

    next();
  };
}
