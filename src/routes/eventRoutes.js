const express = require('express');
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Consultar actividades es publico (no requiere sesion)
router.get('/', getEvents);
router.get('/:id', getEventById);

// Crear, editar y eliminar requieren ser organizador (de la actividad) o admin
router.post('/', protect, authorize('ORGANIZER', 'ADMIN'), createEvent);
router.put('/:id', protect, authorize('ORGANIZER', 'ADMIN'), updateEvent);
router.delete('/:id', protect, authorize('ORGANIZER', 'ADMIN'), deleteEvent);

module.exports = router;
