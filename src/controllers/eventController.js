const mongoose = require('mongoose');
const Event = require('../models/Event');
const Category = require('../models/Category');
const Registration = require('../models/Registration');

// Valida los datos recibidos para crear una actividad
const validateEventData = ({ title, description, category, date, time, location, maxCapacity }) => {
  if (
    !title || !title.trim() ||
    !description || !description.trim() ||
    !category ||
    !date ||
    !time || !time.trim() ||
    !location || !location.trim() ||
    maxCapacity === undefined || maxCapacity === null || maxCapacity === ''
  ) {
    return 'Todos los campos son obligatorios.';
  }

  if (!mongoose.isValidObjectId(category)) {
    return 'La categoria no es valida.';
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return 'La fecha no es valida.';
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (parsedDate < hoy) {
    return 'No se permiten actividades con fecha pasada.';
  }

  const capacidad = Number(maxCapacity);
  if (isNaN(capacidad) || capacidad <= 0) {
    return 'La capacidad maxima debe ser un numero mayor a 0.';
  }

  return null;
};

// POST /api/events
const createEvent = async (req, res) => {
  const { title, description, category, date, time, location, maxCapacity, image } = req.body;

  try {
    const validationError = validateEventData({ title, description, category, date, time, location, maxCapacity });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const categoriaExiste = await Category.findById(category);
    if (!categoriaExiste) {
      return res.status(400).json({ message: 'La categoria indicada no existe.' });
    }

    const newEvent = new Event({
      title: title.trim(),
      description: description.trim(),
      category,
      date,
      time: time.trim(),
      location: location.trim(),
      maxCapacity: Number(maxCapacity),
      image: image || null,
      organizer: req.user.id, // nunca se toma del body, siempre del usuario autenticado
    });

    const savedEvent = await newEvent.save();

    return res.status(201)
      .location(`/api/events/${savedEvent._id}`)
      .json(savedEvent);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al crear la actividad.' });
  }
};

// GET /api/events
// Soporta busqueda de texto y filtros por query params:
// search, category, date, location, available, organizer, status
const getEvents = async (req, res) => {
  try {
    const { search, category, date, location, available, organizer, status } = req.query;

    if (category && !mongoose.isValidObjectId(category)) {
      return res.status(400).json({ message: 'La categoria no es valida.' });
    }
    if (organizer && !mongoose.isValidObjectId(organizer)) {
      return res.status(400).json({ message: 'El organizador no es valido.' });
    }

    const match = {};

    // Busqueda de texto libre sobre titulo y descripcion
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      match.$or = [{ title: regex }, { description: regex }];
    }

    if (category) match.category = new mongoose.Types.ObjectId(category);
    if (organizer) match.organizer = new mongoose.Types.ObjectId(organizer);
    if (status) match.status = status;
    if (location && location.trim()) {
      match.location = new RegExp(location.trim(), 'i');
    }

    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'La fecha indicada no es valida.' });
      }
      const inicioDia = new Date(parsedDate);
      inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(parsedDate);
      finDia.setHours(23, 59, 59, 999);
      match.date = { $gte: inicioDia, $lte: finDia };
    }

    // La disponibilidad no vive en Event: se calcula comparando maxCapacity
    // contra la cantidad de inscripciones CONFIRMED en Registration.
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: Registration.collection.name,
          let: { eventId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$event', '$$eventId'] }, { $eq: ['$status', 'CONFIRMED'] }],
                },
              },
            },
            { $count: 'total' },
          ],
          as: 'confirmedRegistrations',
        },
      },
      {
        $addFields: {
          confirmedCount: { $ifNull: [{ $arrayElemAt: ['$confirmedRegistrations.total', 0] }, 0] },
        },
      },
      {
        $addFields: {
          availableSpots: { $subtract: ['$maxCapacity', '$confirmedCount'] },
        },
      },
    ];

    if (available !== undefined) {
      const quiereDisponibles = available === 'true';
      pipeline.push({
        $match: quiereDisponibles ? { availableSpots: { $gt: 0 } } : { availableSpots: { $lte: 0 } },
      });
    }

    pipeline.push({ $project: { confirmedRegistrations: 0 } });
    pipeline.push({ $sort: { date: 1 } });

    const events = await Event.aggregate(pipeline);

    const populatedEvents = await Event.populate(events, [
      { path: 'category', select: 'name' },
      { path: 'organizer', select: 'firstName lastName email' },
    ]);

    return res.status(200).json(populatedEvents);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar las actividades.' });
  }
};

// GET /api/events/:id
const getEventById = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'El id de la actividad no es valido.' });
  }

  try {
    const event = await Event.findById(id)
      .populate('category', 'name')
      .populate('organizer', 'firstName lastName email');

    if (!event) {
      return res.status(404).json({ message: 'Actividad no encontrada.' });
    }

    // Misma logica de disponibilidad que getEvents: se calcula contra
    // las inscripciones CONFIRMED, ya que no vive como campo en Event.
    const confirmedCount = await Registration.countDocuments({
      event: event._id,
      status: 'CONFIRMED',
    });
    const availableSpots = event.maxCapacity - confirmedCount;

    return res.status(200).json({ ...event.toObject(), confirmedCount, availableSpots });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar la actividad.' });
  }
};

// PUT /api/events/:id
const updateEvent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'El id de la actividad no es valido.' });
  }

  try {
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: 'Actividad no encontrada.' });
    }

    // Un organizador solo puede modificar sus propias actividades; el admin puede cualquiera
    const esDueno = event.organizer.toString() === req.user.id;
    const esAdmin = req.user.role === 'ADMIN';

    if (!esDueno && !esAdmin) {
      return res.status(403).json({ message: 'No tenes permiso para modificar esta actividad.' });
    }

    const { title, description, category, date, time, location, maxCapacity, image, status } = req.body;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ message: 'El titulo no puede estar vacio.' });
      }
      event.title = title.trim();
    }

    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({ message: 'La descripcion no puede estar vacia.' });
      }
      event.description = description.trim();
    }

    if (category !== undefined) {
      if (!mongoose.isValidObjectId(category)) {
        return res.status(400).json({ message: 'La categoria no es valida.' });
      }
      const categoriaExiste = await Category.findById(category);
      if (!categoriaExiste) {
        return res.status(400).json({ message: 'La categoria indicada no existe.' });
      }
      event.category = category;
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'La fecha no es valida.' });
      }
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (parsedDate < hoy) {
        return res.status(400).json({ message: 'No se permiten actividades con fecha pasada.' });
      }
      event.date = date;
    }

    if (time !== undefined) {
      if (!time.trim()) {
        return res.status(400).json({ message: 'La hora no puede estar vacia.' });
      }
      event.time = time.trim();
    }

    if (location !== undefined) {
      if (!location.trim()) {
        return res.status(400).json({ message: 'La ubicacion no puede estar vacia.' });
      }
      event.location = location.trim();
    }

    if (maxCapacity !== undefined) {
      const capacidad = Number(maxCapacity);
      if (isNaN(capacidad) || capacidad <= 0) {
        return res.status(400).json({ message: 'La capacidad maxima debe ser un numero mayor a 0.' });
      }
      event.maxCapacity = capacidad;
    }

    if (image !== undefined) {
      event.image = image;
    }

    if (status !== undefined) {
      event.status = status; // el enum del schema valida que sea un valor permitido
    }

    const updatedEvent = await event.save();

    return res.status(200).json(updatedEvent);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Error interno del servidor al actualizar la actividad.' });
  }
};

// DELETE /api/events/:id
const deleteEvent = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'El id de la actividad no es valido.' });
  }

  try {
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ message: 'Actividad no encontrada.' });
    }

    const esDueno = event.organizer.toString() === req.user.id;
    const esAdmin = req.user.role === 'ADMIN';

    if (!esDueno && !esAdmin) {
      return res.status(403).json({ message: 'No tenes permiso para eliminar esta actividad.' });
    }

    await event.deleteOne();

    return res.status(200).json({ message: 'Actividad eliminada correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al eliminar la actividad.' });
  }
};

module.exports = { createEvent, getEvents, getEventById, updateEvent, deleteEvent };
