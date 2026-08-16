const express = require('express');
const { getUsers, getUserById, updateUser, deleteUser } = require('../controllers/userController');
const { getMyRegistrations } = require('../controllers/registrationController');
const { getMyFavorites } = require('../controllers/favoriteController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Listar y eliminar usuarios son operaciones administrativas
router.get('/', protect, authorize('ADMIN'), getUsers);
router.delete('/:id', protect, authorize('ADMIN'), deleteUser);

// Inscripciones del usuario autenticado (2 segmentos, no choca con /:id)
router.get('/me/registrations', protect, getMyRegistrations);
router.get('/me/favorites', protect, getMyFavorites);

// Consultar/editar un usuario puntual: el propio dueno o un ADMIN
// (la logica de ownership se resuelve dentro del controller)
router.get('/:id', protect, getUserById);
router.put('/:id', protect, updateUser);

module.exports = router;
