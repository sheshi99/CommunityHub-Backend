const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// GET /api/notifications
const getMyNotifications = async (req, res) => {
  try {
    const filters = { user: req.user.id };

    if (req.query.read !== undefined) {
      if (!['true', 'false'].includes(req.query.read)) {
        return res.status(400).json({ message: 'El filtro read debe ser true o false.' });
      }
      filters.read = req.query.read === 'true';
    }

    const notifications = await Notification.find(filters)
      .populate('event', 'title date time location status')
      .sort({ createdAt: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar las notificaciones.' });
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ user: req.user.id, read: false });
    return res.status(200).json({ count });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al contar las notificaciones.' });
  }
};

// PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: 'El id de la notificacion no es valido.' });
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user.id },
      { $set: { read: true } },
      { new: true }
    ).populate('event', 'title date time location status');

    if (!notification) {
      return res.status(404).json({ message: 'Notificacion no encontrada.' });
    }

    return res.status(200).json(notification);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al actualizar la notificacion.' });
  }
};

// PUT /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({
      message: 'Notificaciones marcadas como leidas.',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al actualizar las notificaciones.' });
  }
};

module.exports = { getMyNotifications, getUnreadCount, markAsRead, markAllAsRead };
