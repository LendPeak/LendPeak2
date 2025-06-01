import { Schema, model } from 'mongoose';
import { IUserActivity } from '../models/user.model';

const UserActivitySchema = new Schema<IUserActivity>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  resource: {
    type: String,
    index: true,
  },
  resourceId: {
    type: String,
    index: true,
  },
  ipAddress: {
    type: String,
    required: true,
  },
  userAgent: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  success: {
    type: Boolean,
    required: true,
  },
  errorMessage: String,
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
});

// Indexes for efficient querying
UserActivitySchema.index({ userId: 1, timestamp: -1 });
UserActivitySchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
UserActivitySchema.index({ action: 1, success: 1, timestamp: -1 });

// TTL index to automatically delete old activity logs after 90 days
UserActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const UserActivityModel = model<IUserActivity>('UserActivity', UserActivitySchema);