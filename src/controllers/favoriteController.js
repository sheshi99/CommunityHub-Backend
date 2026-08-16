const mongoose = require('mongoose');
const Favorite = require('../models/Favorite');
const Event = require('../models/Event');

// POST /api/events/:id/favorite
const addFavorite = async (req, res) => {
  const { id: eventId } = req.params;

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'El id de la actividad no es valido.' });
  }

  try {
    const eventExists = await Event.exists({ _id: eventId });

    if (!eventExists) {
      return res.status(404).json({ message: 'Actividad no encontrada.' });
    }

    const favorite = await Favorite.create({
      user: req.user.id,
      event: eventId,
    });

    return res.status(201)
      .location(`/api/events/${eventId}/favorite`)
      .json(favorite);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'La actividad ya esta en tus favoritos.' });
    }
    return res.status(500).json({ message: 'Error interno del servidor al agregar el favorito.' });
  }
};

// DELETE /api/events/:id/favorite
const removeFavorite = async (req, res) => {
  const { id: eventId } = req.params;

  if (!mongoose.isValidObjectId(eventId)) {
    return res.status(400).json({ message: 'El id de la actividad no es valido.' });
  }

  try {
    const favorite = await Favorite.findOneAndDelete({
      user: req.user.id,
      event: eventId,
    });

    if (!favorite) {
      return res.status(404).json({ message: 'La actividad no esta en tus favoritos.' });
    }

    return res.status(200).json({ message: 'Actividad eliminada de favoritos correctamente.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al eliminar el favorito.' });
  }
};

// GET /api/users/me/favorites
const getMyFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user.id })
      .populate({
        path: 'event',
        select: 'title description date time location image status maxCapacity category organizer',
        populate: [
          { path: 'category', select: 'name' },
          { path: 'organizer', select: 'firstName lastName email' },
        ],
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(favorites);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar los favoritos.' });
  }
};

module.exports = { addFavorite, removeFavorite, getMyFavorites };
