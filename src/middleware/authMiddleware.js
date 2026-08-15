const jwt = require('jsonwebtoken');

/**
 * Verifica el JWT enviado en el header "Authorization: Bearer <token>".
 * Si es valido, adjunta { id, role } en req.user y continua.
 */
const protect = (req, res, next) => {
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Error de configuracion del servidor' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'No autorizado, token no proporcionado' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Formato de token invalido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'No autorizado, token invalido o expirado' });
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
      return res.status(403).json({ message: 'No tiene permisos para realizar esta accion' });
    }
    next();
  };
};

module.exports = { protect, authorize };
