import { type Types } from 'mongoose';

import {
  BusinessModel,
  BusinessSettingsModel,
  MembershipModel,
  RefreshTokenModel,
  UserModel,
  type BusinessDocument,
  type BusinessSettingsDocument,
  type MembershipDocument,
  type UserDocument,
} from '../models/index.js';
import { AppError, unauthenticated } from '../lib/errors.js';
import {
  createRefreshTokenValue,
  hashRefreshToken,
  newFamilyId,
  refreshTokenExpiry,
  signAccessToken,
} from '../lib/jwt.js';
import { hashPassword, verifyPassword } from '../lib/passwords.js';
import { env } from '../config/env.js';

export interface ClientContext {
  userAgent: string;
  ip: string;
}

export interface AuthResult {
  user: UserDocument;
  business: BusinessDocument;
  settings: BusinessSettingsDocument;
  membership: MembershipDocument;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  businessName: string;
  stateCode: string;
}

const LOCK_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function pruneAttempts(now: number): void {
  for (const [key, value] of attempts) {
    if (now - value.firstAt > LOCK_WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

function assertNotLocked(email: string): void {
  const now = Date.now();
  pruneAttempts(now);
  const entry = attempts.get(email);

  if (entry !== undefined && entry.count >= env.LOGIN_MAX_ATTEMPTS) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      'Too many failed sign in attempts. Try again in 15 minutes.',
    );
  }
}

function recordFailure(email: string): void {
  const now = Date.now();
  const entry = attempts.get(email);

  if (entry === undefined || now - entry.firstAt > LOCK_WINDOW_MS) {
    attempts.set(email, { count: 1, firstAt: now });

    return;
  }

  entry.count += 1;
}

function clearFailures(email: string): void {
  attempts.delete(email);
}

/** Test helper, never called by request handling. */
export function resetLoginAttempts(): void {
  attempts.clear();
}

async function createSession(
  user: UserDocument,
  membership: MembershipDocument,
  context: ClientContext,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken({
    userId: user._id.toString(),
    businessId: membership.businessId.toString(),
    role: membership.role,
    tokenVersion: user.tokenVersion,
  });

  const refreshToken = createRefreshTokenValue();

  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: hashRefreshToken(refreshToken),
    familyId: newFamilyId(),
    expiresAt: refreshTokenExpiry(),
    userAgent: context.userAgent.slice(0, 300),
    ip: context.ip.slice(0, 60),
  });

  return { accessToken, refreshToken };
}

async function loadActiveMembership(userId: Types.ObjectId): Promise<MembershipDocument> {
  const membership = await MembershipModel.findOne({ userId, status: 'active' })
    .sort({ createdAt: 1 })
    .exec();

  if (membership === null) {
    throw unauthenticated('This account has no active business');
  }

  return membership;
}

export async function registerUser(
  input: RegisterInput,
  context: ClientContext,
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await UserModel.exists({ email });

  if (existing !== null) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);

  const user = await UserModel.create({
    name: input.name.trim(),
    email,
    passwordHash,
  });

  let business: BusinessDocument | null = null;
  let membership: MembershipDocument | null = null;

  try {
    business = await BusinessModel.create({
      name: input.businessName.trim(),
      stateCode: input.stateCode,
      currency: 'INR',
    });

    membership = await MembershipModel.create({
      userId: user._id,
      businessId: business._id,
      role: 'owner',
      status: 'active',
    });

    const settings = await BusinessSettingsModel.create({ businessId: business._id });
    const { accessToken, refreshToken } = await createSession(user, membership, context);

    return { user, business, settings, membership, accessToken, refreshToken };
  } catch (error) {
    // A partial registration would leave an account that cannot sign in to
    // anything, so undo the rows this request created, then rethrow.
    await Promise.allSettled([
      business === null
        ? Promise.resolve()
        : BusinessSettingsModel.deleteMany({ businessId: business._id }).exec(),
      membership === null
        ? Promise.resolve()
        : MembershipModel.deleteOne({ _id: membership._id }).exec(),
      business === null ? Promise.resolve() : BusinessModel.deleteOne({ _id: business._id }).exec(),
      RefreshTokenModel.deleteMany({ userId: user._id }).exec(),
      UserModel.deleteOne({ _id: user._id }).exec(),
    ]);

    throw error;
  }
}

export async function loginUser(
  input: { email: string; password: string },
  context: ClientContext,
): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  assertNotLocked(email);

  const user = await UserModel.findOne({ email }).select('+passwordHash').exec();
  const passwordMatches =
    user === null ? false : await verifyPassword(user.passwordHash, input.password);

  if (user === null || !passwordMatches) {
    recordFailure(email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const membership = await loadActiveMembership(user._id);
  const [business, settings] = await Promise.all([
    BusinessModel.findById(membership.businessId).exec(),
    BusinessSettingsModel.findOne({ businessId: membership.businessId }).exec(),
  ]);

  if (business === null) {
    throw unauthenticated('The business for this account no longer exists');
  }

  let settingsDocument = settings;

  if (settingsDocument === null) {
    settingsDocument = await BusinessSettingsModel.create({ businessId: membership.businessId });
  }

  clearFailures(email);
  user.lastLoginAt = new Date();
  await user.save();

  const { accessToken, refreshToken } = await createSession(user, membership, context);

  return {
    user,
    business,
    settings: settingsDocument,
    membership,
    accessToken,
    refreshToken,
  };
}

export async function revokeFamily(familyId: string): Promise<void> {
  await RefreshTokenModel.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).exec();
}

export async function rotateRefreshToken(
  rawToken: string,
  context: ClientContext,
): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(rawToken);
  const record = await RefreshTokenModel.findOne({ tokenHash }).exec();

  if (record === null) {
    throw unauthenticated('Session not recognised. Sign in again.');
  }

  if (record.replacedByHash !== null) {
    // Someone presented a token that was already rotated. Either the token was
    // stolen or a client raced itself. Revoke the whole family either way.
    await revokeFamily(record.familyId);
    throw new AppError(
      401,
      'REFRESH_REUSED',
      'This session was already used and has been revoked. Sign in again.',
    );
  }

  if (record.revokedAt !== null || record.expiresAt.getTime() <= Date.now()) {
    throw unauthenticated('Session expired. Sign in again.');
  }

  const user = await UserModel.findById(record.userId).exec();
  const membership = user === null ? null : await loadActiveMembership(user._id);

  if (user === null || membership === null) {
    await revokeFamily(record.familyId);
    throw unauthenticated('This account can no longer sign in');
  }

  const [business, settings] = await Promise.all([
    BusinessModel.findById(membership.businessId).exec(),
    BusinessSettingsModel.findOne({ businessId: membership.businessId }).exec(),
  ]);

  if (business === null || settings === null) {
    await revokeFamily(record.familyId);
    throw unauthenticated('The business for this account is incomplete');
  }

  const nextRaw = createRefreshTokenValue();
  const nextHash = hashRefreshToken(nextRaw);

  record.replacedByHash = nextHash;
  record.revokedAt = new Date();
  await record.save();

  await RefreshTokenModel.create({
    userId: record.userId,
    tokenHash: nextHash,
    familyId: record.familyId,
    expiresAt: refreshTokenExpiry(),
    userAgent: context.userAgent.slice(0, 300),
    ip: context.ip.slice(0, 60),
  });

  const accessToken = await signAccessToken({
    userId: user._id.toString(),
    businessId: membership.businessId.toString(),
    role: membership.role,
    tokenVersion: user.tokenVersion,
  });

  return {
    user,
    business,
    settings,
    membership,
    accessToken,
    refreshToken: nextRaw,
  };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshTokenModel.updateOne(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).exec();
}

export async function revokeAllSessions(userId: Types.ObjectId): Promise<void> {
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  ).exec();
}

export async function changePassword(
  userId: Types.ObjectId,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await UserModel.findById(userId).select('+passwordHash').exec();

  if (user === null) {
    throw unauthenticated();
  }

  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();
  await revokeAllSessions(userId);
}

export async function updateProfile(
  userId: Types.ObjectId,
  input: { name?: string; phone?: string | null },
): Promise<UserDocument> {
  const user = await UserModel.findById(userId).exec();

  if (user === null) {
    throw unauthenticated();
  }

  if (input.name !== undefined) {
    user.name = input.name.trim();
  }

  if (input.phone !== undefined) {
    user.phone = input.phone;
  }

  await user.save();

  return user;
}

export async function currentSession(userId: Types.ObjectId, businessId: Types.ObjectId) {
  const [user, business, settings, membership] = await Promise.all([
    UserModel.findById(userId).exec(),
    BusinessModel.findById(businessId).exec(),
    BusinessSettingsModel.findOne({ businessId }).exec(),
    MembershipModel.findOne({ userId, businessId, status: 'active' }).exec(),
  ]);

  if (user === null || business === null || membership === null) {
    throw unauthenticated('Session is no longer valid');
  }

  return { user, business, settings, membership };
}
