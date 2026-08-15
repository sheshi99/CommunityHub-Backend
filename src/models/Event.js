const mongoose = require('mongoose');

const EVENT_STATUS = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true, 
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true, 
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    maxCapacity: {
      type: Number,
      required: true,
      min: [1, 'La capacidad maxima debe ser al menos 1'],
    },
    image: {
      type: String,
      default: null,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: EVENT_STATUS,
      default: 'DRAFT',
    },
  },
  { timestamps: true }
);

eventSchema.index({ organizer: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ date: 1 });

module.exports = mongoose.model('Event', eventSchema);
module.exports.EVENT_STATUS = EVENT_STATUS;
