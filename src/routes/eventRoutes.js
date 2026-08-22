const express = require('express');
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const {
  registerForEvent,
  cancelRegistration,
  getEventParticipants,
} = require('../controllers/registrationController');
const { addFavorite, removeFavorite } = require('../controllers/favoriteController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Consultar actividades es publico (no requiere sesion)
router.get('/', getEvents);
router.get('/:id', getEventById);

// Crear, editar y eliminar requieren ser organizador (de la actividad) o admin
router.post('/', protect, authorize('ORGANIZER', 'ADMIN'), createEvent);
router.put('/:id', protect, authorize('ORGANIZER', 'ADMIN'), updateEvent);
router.delete('/:id', protect, authorize('ORGANIZER', 'ADMIN'), deleteEvent);

// Inscripcion a una actividad: cualquier usuario autenticado
router.post('/:id/register', protect, registerForEvent);
router.delete('/:id/register', protect, cancelRegistration);
router.get('/:id/participants', protect, authorize('ORGANIZER', 'ADMIN'), getEventParticipants);

// Favoritos del usuario autenticado
router.post('/:id/favorite', protect, addFavorite);
router.delete('/:id/favorite', protect, removeFavorite);

module.exports = router;
