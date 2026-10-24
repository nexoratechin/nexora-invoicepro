import { z } from 'zod';

import { GST_STATE_CODES } from '@nexora/shared';

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Must be a 24 character hex id');

const stateCodeSchema = z
  .string()
  .trim()
  .refine((value) => value in GST_STATE_CODES, 'Choose a valid GST state code');

const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(254),
    password: passwordSchema,
    businessName: z.string().trim().min(2).max(120),
    stateCode: stateCodeSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(20).max(200).optional(),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, 'Use 8 to 15 digits, optionally starting with +')
      .nullable()
      .optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: z.email().max(254) }).strict();
