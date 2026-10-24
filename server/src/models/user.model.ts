import { type HydratedDocument, type InferSchemaType, model, Schema } from 'mongoose';

import { jsonPlugin } from './plugins.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    /** argon2id hash. Never selected unless explicitly asked for. */
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true, default: null, maxlength: 20 },
    lastLoginAt: { type: Date, default: null },
    /** Bumped to invalidate every access token issued before a password change. */
    tokenVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

userSchema.plugin(jsonPlugin);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);
