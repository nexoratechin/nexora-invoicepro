import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

export interface RefreshToken {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByHash: string | null;
  userAgent: string;
  ip: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, default: '', maxlength: 300 },
    ip: { type: String, default: '', maxlength: 60 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
