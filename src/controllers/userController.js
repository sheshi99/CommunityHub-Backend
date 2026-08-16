const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Favorite = require('../models/Favorite');
const Notification = require('../models/Notification');
const { ROLES } = User;
const { validateEmailFormat, validatePasswordComplexity } = require('../utils/validators');

// Arma la respuesta publica de un usuario, sin exponer nunca el password
// (necesario aca porque, a diferencia de un find() normal, un documento
// recien modificado en memoria puede tener el password cargado aunque el
// schema tenga select:false).
const toSafeUser = (user) => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  profileImage: user.profileImage,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// GET /api/users (solo ADMIN)
const getUsers = async (req, res) => {
  try {
    const filtros = {};
    if (req.query.role) {
      if (!ROLES.includes(req.query.role)) {
        return res.status(400).json({ message: 'El rol indicado no es valido.' });
      }
      filtros.role = req.query.role;
    }

    const users = await User.find(filtros).sort({ createdAt: -1 });

    return res.status(200).json(users.map(toSafeUser));
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar los usuarios.' });
  }
};

// GET /api/users/:id (el propio usuario o un ADMIN)
const getUserById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'El id del usuario no es valido.' });
  }

  const esDueno = req.user.id === id;
  const esAdmin = req.user.role === 'ADMIN';

  if (!esDueno && !esAdmin) {
    return res.status(403).json({ message: 'No tenes permiso para consultar este usuario.' });
  }

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.status(200).json(toSafeUser(user));
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar el usuario.' });
  }
};

// PUT /api/users/:id (el propio usuario o un ADMIN)
const updateUser = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'El id del usuario no es valido.' });
  }

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const esDueno = req.user.id === id;
    const esAdmin = req.user.role === 'ADMIN';

    if (!esDueno && !esAdmin) {
      return res.status(403).json({ message: 'No tenes permiso para modificar este usuario.' });
    }

    const { firstName, lastName, email, profileImage, password, role } = req.body;

    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return res.status(400).json({ message: 'El nombre no puede estar vacio.' });
      }
      user.firstName = firstName.trim();
    }

    if (lastName !== undefined) {
      if (!lastName.trim()) {
        return res.status(400).json({ message: 'El apellido no puede estar vacio.' });
      }
      user.lastName = lastName.trim();
    }

    if (email !== undefined) {
      const emailNormalizado = email.trim().toLowerCase();
      if (!validateEmailFormat(emailNormalizado)) {
        return res.status(400).json({ message: 'El formato del correo electronico no es valido.' });
      }
      const emailEnUso = await User.findOne({ email: emailNormalizado, _id: { $ne: id } });
      if (emailEnUso) {
        return res.status(400).json({ message: 'El correo electronico ya esta registrado.' });
      }
      user.email = emailNormalizado;
    }

    if (profileImage !== undefined) {
      user.profileImage = profileImage;
    }

    if (password !== undefined) {
      if (!validatePasswordComplexity(password.trim())) {
        return res.status(400).json({
          message: 'La contrasena debe tener al menos 8 caracteres, incluir mayuscula, minuscula, numero y caracter especial.',
        });
      }
      user.password = await bcrypt.hash(password.trim(), 10);
    }

    if (role !== undefined) {
      if (!esAdmin) {
        return res.status(403).json({ message: 'No tenes permiso para cambiar el rol.' });
      }
      if (esDueno) {
        return res.status(403).json({ message: 'No podes cambiar el rol de tu propia cuenta.' });
      }
      if (!ROLES.includes(role)) {
        return res.status(400).json({ message: 'El rol indicado no es valido.' });
      }
      user.role = role;
    }

    const updatedUser = await user.save();

    return res.status(200).json(toSafeUser(updatedUser));
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Error interno del servidor al actualizar el usuario.' });
  }
};

// DELETE /api/users/:id (solo ADMIN)
const deleteUser = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'El id del usuario no es valido.' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ message: 'No podes eliminar tu propia cuenta desde este endpoint.' });
  }

  try {
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Evita dejar referencias huerfanas. Una cuenta con actividad historica
    // debe conservarse para mantener la integridad de la plataforma.
    const [hasEvents, hasRegistrations, hasFavorites, hasNotifications] = await Promise.all([
      Event.exists({ organizer: id }),
      Registration.exists({ user: id }),
      Favorite.exists({ user: id }),
      Notification.exists({ user: id }),
    ]);

    if (hasEvents || hasRegistrations || hasFavorites || hasNotifications) {
      return res.status(409).json({
        message: 'No se puede eliminar el usuario porque tiene actividad asociada en la plataforma.',
      });
    }

    await user.deleteOne();

    return res.status(200).json({ message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al eliminar el usuario.' });
  }
};

module.exports = { getUsers, getUserById, updateUser, deleteUser };
