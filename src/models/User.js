const mongoose = require('mongoose');

const ROLES = ['ADMIN', 'ORGANIZER', 'USER'];

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'El apellido es obligatorio'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'El email no tiene un formato valido'],
    },
    password: {
      type: String,
      required: [true, 'La contrasena es obligatoria'],
      minlength: [6, 'La contrasena debe tener al menos 6 caracteres'],
      select: false, // nunca se devuelve por defecto en las consultas
      // Debe almacenarse siempre hasheada con bcrypt/bcryptjs, nunca en texto plano.
      // El hasheo se realizara en la capa de servicio/controlador de Auth.
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
