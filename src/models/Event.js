const mongoose = require('mongoose');

const EVENT_STATUS = ['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'];

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'El titulo del evento es obligatorio'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'La descripcion del evento es obligatoria'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'La categoria del evento es obligatoria'],
    },
    date: {
      type: Date,
      required: [true, 'La fecha del evento es obligatoria'],
    },
    time: {
      type: String,
      required: [true, 'La hora del evento es obligatoria'],
    },
    location: {
      type: String,
      required: [true, 'La ubicacion del evento es obligatoria'],
      trim: true,
    },
    maxCapacity: {
      type: Number,
      required: [true, 'La capacidad maxima es obligatoria'],
      min: [1, 'La capacidad maxima debe ser al menos 1'],
    },
    image: {
      type: String,
      default: null,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El organizador del evento es obligatorio'],
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
