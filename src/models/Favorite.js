const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es obligatorio'],
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'El evento es obligatorio'],
    },
  },
  { timestamps: true }
);

// Un mismo usuario no puede marcar el mismo evento como favorito mas de una vez
favoriteSchema.index({ user: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
