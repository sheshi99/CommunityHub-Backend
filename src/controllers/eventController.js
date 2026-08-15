const mongoose = require('mongoose');
const Event = require('../models/Event');
const Category = require('../models/Category');

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
const getEvents = async (req, res) => {
  try {
    const filtros = {};
    if (req.query.category) filtros.category = req.query.category;
    if (req.query.status) filtros.status = req.query.status;
    if (req.query.organizer) filtros.organizer = req.query.organizer;

    const events = await Event.find(filtros)
      .populate('category', 'name')
      .populate('organizer', 'firstName lastName email')
      .sort({ date: 1 });

    return res.status(200).json(events);
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

    return res.status(200).json(event);
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
