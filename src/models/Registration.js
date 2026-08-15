const mongoose = require('mongoose');

const REGISTRATION_STATUS = ['CONFIRMED', 'CANCELLED'];

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true, 
    },
    status: {
      type: String,
      enum: REGISTRATION_STATUS,
      default: 'CONFIRMED',
    },
  },
  { timestamps: true }
);

// Un mismo usuario no puede inscribirse dos veces al mismo evento
registrationSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
