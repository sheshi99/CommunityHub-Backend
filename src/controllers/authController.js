/**
 * Controlador de Auth.
 *
 * Estructura inicial preparada para que en una fase posterior se implemente
 * la logica real de cada accion (hash de password con bcrypt, validaciones,
 * emision de cookies/tokens, etc.). Por ahora cada handler solo responde
 * 501 Not Implemented para dejar las rutas operativas sin logica de negocio.
 */

// POST /auth/register
const register = async (req, res) => {
  res.status(501).json({ message: 'Registro no implementado todavia' });
};

// POST /auth/login
const login = async (req, res) => {
  res.status(501).json({ message: 'Login no implementado todavia' });
};

// POST /auth/logout
const logout = async (req, res) => {
  res.status(501).json({ message: 'Logout no implementado todavia' });
};

// GET /auth/me (requiere middleware "protect")
const getMe = async (req, res) => {
  res.status(501).json({ message: '/auth/me no implementado todavia' });
};

module.exports = { register, login, logout, getMe };
