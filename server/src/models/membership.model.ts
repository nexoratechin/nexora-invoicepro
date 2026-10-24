import { type HydratedDocument, type InferSchemaType, model, Schema, type Types } from 'mongoose';

import { MEMBERSHIP_ROLES } from '@nexora/shared';

import { jsonPlugin } from './plugins.js';

const membershipSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    role: { type: String, enum: MEMBERSHIP_ROLES, required: true, default: 'owner' },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

membershipSchema.index({ userId: 1, status: 1 });
membershipSchema.index({ businessId: 1, role: 1 });
membershipSchema.index({ userId: 1, businessId: 1 }, { unique: true });

membershipSchema.plugin(jsonPlugin);

export type Membership = InferSchemaType<typeof membershipSchema> & {
  userId: Types.ObjectId;
  businessId: Types.ObjectId;
};
export type MembershipDocument = HydratedDocument<Membership>;

export const MembershipModel = model('Membership', membershipSchema);
