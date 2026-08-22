const Registration = require('../models/Registration');
const Notification = require('../models/Notification');

const notifyConfirmedParticipants = async ({ eventId, type, message }) => {
  const userIds = await Registration.distinct('user', {
    event: eventId,
    status: 'CONFIRMED',
  });

  if (userIds.length === 0) return { createdCount: 0 };

  const notifications = userIds.map((userId) => ({
    user: userId,
    event: eventId,
    type,
    message,
  }));

  await Notification.insertMany(notifications);
  return { createdCount: notifications.length };
};

module.exports = { notifyConfirmedParticipants };
