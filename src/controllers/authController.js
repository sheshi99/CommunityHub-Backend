const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { validateEmailFormat, validatePasswordComplexity } = require('../utils/validators');

// Valida los datos recibidos en el registro
const validateRegistrationData = ({ firstName, lastName, email, password }) => {
  if (
    !firstName || !firstName.trim() ||
    !lastName || !lastName.trim() ||
    !email || !email.trim() ||
    !password || !password.trim()
  ) {
    return 'Todos los campos son obligatorios.';
  }

  if (!validateEmailFormat(email.trim())) {
    return 'El formato del correo electronico no es valido.';
  }

  if (!validatePasswordComplexity(password.trim())) {
    return 'La contrasena debe tener al menos 8 caracteres, incluir mayuscula, minuscula, numero y caracter especial.';
  }

  return null;
};

// POST /auth/register
const register = async (req, res) => {
  const { firstName, lastName, email, password, profileImage } = req.body;

  try {
    // 1. Validar datos
    const validationError = validateRegistrationData({ firstName, lastName, email, password });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // 2. Verificar si el correo ya existe
    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'El correo electronico ya esta registrado.' });
    }

    // 3. Encriptar contrasena
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    // 4. Crear el usuario (el rol por defecto lo asigna el schema: 'USER')
    const newUser = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      profileImage: profileImage || null,
    });

    const savedUser = await newUser.save();

    return res.status(201)
      .location(`/api/auth/${savedUser._id}`)
      .json({
        id: savedUser._id,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        email: savedUser.email,
        role: savedUser.role,
      });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al registrar el usuario.',
    });
  }
};

// POST /auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !email.trim() || !password || !password.trim()) {
    return res.status(400).json({ message: 'Correo y contrasena son requeridos.' });
  }

  if (!validateEmailFormat(email.trim())) {
    return res.status(400).json({ message: 'El formato del correo no es valido.' });
  }

  try {
    // password tiene select:false en el schema, hay que pedirlo explicitamente
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Correo o contrasena incorrectos.' });
    }

    const isPasswordValid = await bcrypt.compare(password.trim(), user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Correo o contrasena incorrectos.' });
    }

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      token,
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al iniciar sesion.' });
  }
};

// POST /auth/logout
// En JWT, el logout es manejado en el cliente eliminando el token almacenado.
const logout = async (req, res) => {
  return res.status(200).json({ message: 'Sesion cerrada correctamente.' });
};

// GET /auth/me (requiere middleware "protect")
const getMe = async (req, res) => {
  try {
    // password ya viene excluido por el select:false del schema
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    return res.status(200).json({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al obtener el perfil.' });
  }
};

module.exports = { register, login, logout, getMe };
