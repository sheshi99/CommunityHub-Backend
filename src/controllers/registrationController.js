const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Event = require('../models/Event');
const {
  notifyEventCapacityReached,
  notifyEventCapacityAvailable,
} = require('../services/capacityNotificationService');

const requestError = (status, message) => Object.assign(new Error(message), { status });

const lockEventCapacity = (eventId, session) => Event.updateOne(
  { _id: eventId },
  { $inc: { capacityVersion: 1 } },
  { session }
);

const notifyOrganizerIfFull = async (event, confirmedCountBeforeRegistration) => {
  if (confirmedCountBeforeRegistration + 1 !== event.maxCapacity) return;

  try {
    await notifyEventCapacityReached({
      eventId: event._id,
      organizerId: event.organizer,
      eventTitle: event.title,
      maxCapacity: event.maxCapacity,
    });
  } catch (error) {
    // La inscripcion ya fue confirmada: un fallo externo de AWS no debe
    // revertirla ni devolver un error falso al participante.
    console.error(`No se pudo invocar la Lambda de cupo completo: ${error.message}`);
  }
};

const clearFullCapacityNotification = async (event) => {
  try {
    await notifyEventCapacityAvailable({
      eventId: event._id,
      organizerId: event.organizer,
      eventTitle: event.title,
      maxCapacity: event.maxCapacity,
    });
  } catch (error) {
    // La cancelacion ya fue aplicada y no debe fallar por un servicio externo.
    console.error(`No se pudo limpiar la notificacion de cupo completo: ${error.message}`);
  }
};

// POST /api/events/:id/register
const registerForEvent = async (req, res) => {
  const { id: eventId } = req.params;

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ success: false, message: 'El id de la actividad no es valido.' });
  }

  const session = await mongoose.startSession();
  let event;
  let registration;
  let confirmedCount = 0;
  let responseStatus = 201;

  try {
    await session.withTransaction(async () => {
      event = await Event.findById(eventId).session(session);
      if (!event) throw requestError(404, 'Actividad no encontrada.');
      if (event.organizer.toString() === req.user.id) {
        throw requestError(403, 'No puedes inscribirte en una actividad que organizas.');
      }
      if (event.status !== 'PUBLISHED') {
        throw requestError(400, 'Solo es posible inscribirse a actividades publicadas.');
      }

      // Esta escritura toma un bloqueo sobre la actividad. withTransaction
      // reintenta si otra inscripcion concurrente modifico el mismo documento.
      await lockEventCapacity(eventId, session);

      registration = await Registration.findOne({ user: req.user.id, event: eventId }).session(session);
      if (registration?.status === 'CONFIRMED') {
        throw requestError(409, 'Ya estas inscripto en esta actividad.');
      }

      confirmedCount = await Registration.countDocuments({
        event: eventId,
        status: 'CONFIRMED',
      }).session(session);
      if (confirmedCount >= event.maxCapacity) {
        throw requestError(409, 'No hay cupos disponibles para esta actividad.');
      }

      if (registration) {
        registration.status = 'CONFIRMED';
        await registration.save({ session });
        responseStatus = 200;
      } else {
        [registration] = await Registration.create([{
          user: req.user.id,
          event: eventId,
          status: 'CONFIRMED',
        }], { session });
      }
    });

    await notifyOrganizerIfFull(event, confirmedCount);

    return res.status(responseStatus)
      .location(`/api/events/${eventId}/register`)
      .json(registration);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Ya estas inscripto en esta actividad.' });
    }
    return res.status(500).json({ success: false, message: 'Error interno del servidor al procesar la inscripcion.' });
  } finally {
    await session.endSession();
  }
};

// DELETE /api/events/:id/register
const cancelRegistration = async (req, res) => {
  const { id: eventId } = req.params;

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ success: false, message: 'El id de la actividad no es valido.' });
  }

  try {
    const registration = await Registration.findOne({
      user: req.user.id,
      event: eventId,
      status: 'CONFIRMED',
    });

    if (!registration) {
      return res.status(404).json({ success: false, message: 'No estas inscripto en esta actividad.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Actividad no encontrada.' });
    }

    const confirmedCount = await Registration.countDocuments({
      event: eventId,
      status: 'CONFIRMED',
    });
    const wasFull = confirmedCount >= event.maxCapacity;

    registration.status = 'CANCELLED';
    await registration.save();

    if (wasFull) {
      await clearFullCapacityNotification(event);
    }

    return res.status(200).json({ message: 'Inscripcion cancelada correctamente.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor al cancelar la inscripcion.' });
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
    return res.status(500).json({ success: false, message: 'Error interno del servidor al consultar las inscripciones.' });
  }
};

module.exports = { registerForEvent, cancelRegistration, getMyRegistrations };
