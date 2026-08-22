const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verifica el JWT enviado en el header "Authorization: Bearer <token>".
 * Si es valido, adjunta { id, role } en req.user y continua.
 */
const protect = async (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ success: false, message: 'Error de configuracion del servidor' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: 'No autorizado, token no proporcionado' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Formato de token invalido' });
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'No autorizado, token invalido o expirado' });
  }

  try {
    const user = await User.findById(decoded.sub).select('role');
    if (!user) {
      return res.status(401).json({ success: false, message: 'No autorizado, el usuario ya no existe' });
    }

    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor al validar la sesion' });
  }
};

/**
 * Middleware de autorizacion por roles.
 * Uso futuro: router.get('/ruta', protect, authorize('ADMIN', 'ORGANIZER'), controller)
 * Requiere que "protect" se haya ejecutado antes (necesita req.user).
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'No tiene permisos para realizar esta accion' });
    }
    next();
  };
};

module.exports = { protect, authorize };
