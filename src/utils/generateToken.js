const jwt = require('jsonwebtoken');

/**
 * Genera un JWT firmado para un usuario.
 * @param {string} userId - id del documento User (payload minimo: sub + role).
 * @param {string} [role] - rol del usuario, util para autorizacion por roles.
 * @returns {string} token firmado
 */
const generateToken = (userId, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no esta definida en las variables de entorno');
  }

  return jwt.sign({ sub: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

module.exports = generateToken;
