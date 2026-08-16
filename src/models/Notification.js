const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'EVENT_REMINDER',
  'EVENT_UPDATED',
  'EVENT_CANCELLED',
  'REGISTRATION_CONFIRMED',
  'EVENT_CAPACITY_REACHED',
  'GENERAL',
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      default: 'GENERAL',
    },
    message: {
      type: String,
      required: true, 
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
