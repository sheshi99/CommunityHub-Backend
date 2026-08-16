const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

// POST /api/events/:id/register
const registerForEvent = async (req, res) => {
  const { id: eventId } = req.params;

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'El id de la actividad no es valido.' });
  }

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: 'Actividad no encontrada.' });
    }

    if (event.status !== 'PUBLISHED') {
      return res.status(400).json({ message: 'Solo es posible inscribirse a actividades publicadas.' });
    }

    let registration = await Registration.findOne({ user: req.user.id, event: eventId });

    if (registration && registration.status === 'CONFIRMED') {
      return res.status(409).json({ message: 'Ya estas inscripto en esta actividad.' });
    }

    // El cupo se calcula contra las inscripciones CONFIRMED actuales,
    // igual que la disponibilidad que expone GET /api/events.
    const confirmedCount = await Registration.countDocuments({ event: eventId, status: 'CONFIRMED' });
    if (confirmedCount >= event.maxCapacity) {
      return res.status(409).json({ message: 'No hay cupos disponibles para esta actividad.' });
    }

    if (registration) {
      // Ya existia una inscripcion cancelada previamente: se reactiva
      // (el indice unico user+event no permite crear un segundo documento).
      registration.status = 'CONFIRMED';
      await registration.save();
      return res.status(200).json(registration);
    }

    registration = await Registration.create({
      user: req.user.id,
      event: eventId,
      status: 'CONFIRMED',
    });

    return res.status(201)
      .location(`/api/events/${eventId}/register`)
      .json(registration);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya estas inscripto en esta actividad.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor al procesar la inscripcion.' });
  }
};

// DELETE /api/events/:id/register
const cancelRegistration = async (req, res) => {
  const { id: eventId } = req.params;

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'El id de la actividad no es valido.' });
  }

  try {
    const registration = await Registration.findOne({
      user: req.user.id,
      event: eventId,
      status: 'CONFIRMED',
    });

    if (!registration) {
      return res.status(404).json({ message: 'No estas inscripto en esta actividad.' });
    }

    registration.status = 'CANCELLED';
    await registration.save();

    return res.status(200).json({ message: 'Inscripcion cancelada correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al cancelar la inscripcion.' });
  }
};

// GET /api/users/me/registrations
const getMyRegistrations = async (req, res) => {
  try {
    const filtros = { user: req.user.id };
    if (req.query.status) filtros.status = req.query.status;

    const registrations = await Registration.find(filtros)
      .populate({
        path: 'event',
        select: 'title description date time location image status maxCapacity category',
        populate: { path: 'category', select: 'name' },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(registrations);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar las inscripciones.' });
  }
};

module.exports = { registerForEvent, cancelRegistration, getMyRegistrations };
