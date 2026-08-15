const mongoose = require('mongoose');

const ROLES = ['ADMIN', 'ORGANIZER', 'USER'];

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true, 
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // nunca se devuelve por defecto en las consultas

    },
    profileImage: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'USER',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
