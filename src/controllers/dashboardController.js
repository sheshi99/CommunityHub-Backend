const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Favorite = require('../models/Favorite');
const Notification = require('../models/Notification');

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const buildChartSeries = (items) => ({
  labels: items.map((item) => item.label),
  datasets: [
    {
      label: 'Cantidad',
      data: items.map((item) => item.value),
    },
  ],
});

const buildSummaryCard = (label, value, hint = '') => ({
  label,
  value,
  hint,
});

const getMonthlyRegistrationTrend = async () => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const stats = await Registration.aggregate([
    {
      $match: {
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        total: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  const monthlyMap = new Map();
  for (let i = 0; i < 6; i += 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    d.setDate(1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    monthlyMap.set(key, { label: monthNames[d.getMonth()], value: 0 });
  }

  stats.forEach((entry) => {
    const key = `${entry._id.year}-${entry._id.month}`;
    if (monthlyMap.has(key)) {
      monthlyMap.get(key).value = entry.total;
    }
  });

  return Array.from(monthlyMap.values());
};

const getAdminDashboard = async () => {
  const [
    registeredUsers,
    organizers,
    admins,
    activities,
    registrations,
    draftActivities,
    activeActivities,
    cancelledActivities,
    finishedActivities,
    usersByRole,
    eventStatus,
    monthlyRegistrations,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'ORGANIZER' }),
    User.countDocuments({ role: 'ADMIN' }),
    Event.countDocuments(),
    Registration.countDocuments(),
    Event.countDocuments({ status: 'DRAFT' }),
    Event.countDocuments({ status: 'PUBLISHED' }),
    Event.countDocuments({ status: 'CANCELLED' }),
    Event.countDocuments({ status: 'FINISHED' }),
    User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 } } }]),
    Event.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]),
    getMonthlyRegistrationTrend(),
  ]);

  const roleMap = Object.fromEntries(usersByRole.map((entry) => [entry._id, entry.total]));
  const statusMap = Object.fromEntries(eventStatus.map((entry) => [entry._id, entry.total]));

  const adminStats = {
    registeredUsers,
    organizers,
    admins,
    activities,
    registrations,
    draftActivities,
    activeActivities,
    cancelledActivities,
    finishedActivities,
  };

  return {
    role: 'ADMIN',
    generatedAt: new Date().toISOString(),
    stats: adminStats,
    summary: [
      buildSummaryCard('Usuarios', registeredUsers, 'Total del sistema'),
      buildSummaryCard('Organizadores', organizers, 'roles activos'),
      buildSummaryCard('Eventos', activities, 'actividades registradas'),
      buildSummaryCard('Inscripciones', registrations, 'total confirmadas'),
    ],
    charts: {
      usersByRole: buildChartSeries(
        ['ADMIN', 'ORGANIZER', 'USER'].map((role) => ({
          label: role,
          value: roleMap[role] || 0,
        }))
      ),
      eventsByStatus: buildChartSeries(
        ['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'].map((status) => ({
          label: status,
          value: statusMap[status] || 0,
        }))
      ),
      monthlyRegistrations: buildChartSeries(monthlyRegistrations),
    },
  };
};

const getOrganizerDashboard = async (userId) => {
  const eventFilter = { organizer: userId };
  const organizedEventIds = await Event.find(eventFilter).distinct('_id');

  const [
    activities,
    draftActivities,
    activeActivities,
    cancelledActivities,
    finishedActivities,
    registrations,
    confirmedRegistrations,
    cancelledRegistrations,
    eventsByStatus,
    topEvents,
  ] = await Promise.all([
    Event.countDocuments(eventFilter),
    Event.countDocuments({ ...eventFilter, status: 'DRAFT' }),
    Event.countDocuments({ ...eventFilter, status: 'PUBLISHED' }),
    Event.countDocuments({ ...eventFilter, status: 'CANCELLED' }),
    Event.countDocuments({ ...eventFilter, status: 'FINISHED' }),
    Registration.countDocuments({ event: { $in: organizedEventIds } }),
    Registration.countDocuments({ event: { $in: organizedEventIds }, status: 'CONFIRMED' }),
    Registration.countDocuments({ event: { $in: organizedEventIds }, status: 'CANCELLED' }),
    Event.aggregate([
      { $match: eventFilter },
      { $group: { _id: '$status', total: { $sum: 1 } } },
    ]),
    Event.aggregate([
      { $match: eventFilter },
      { $lookup: { from: 'registrations', localField: '_id', foreignField: 'event', as: 'registrations' } },
      { $project: { title: 1, registrationsCount: { $size: '$registrations' } } },
      { $sort: { registrationsCount: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const statusMap = Object.fromEntries(eventsByStatus.map((entry) => [entry._id, entry.total]));

  return {
    role: 'ORGANIZER',
    generatedAt: new Date().toISOString(),
    stats: {
      activities,
      draftActivities,
      activeActivities,
      cancelledActivities,
      finishedActivities,
      registrations,
      confirmedRegistrations,
      cancelledRegistrations,
    },
    summary: [
      buildSummaryCard('Eventos', activities, 'total creados'),
      buildSummaryCard('Publicados', activeActivities, 'activos en curso'),
      buildSummaryCard('Inscripciones', registrations, 'participantes totales'),
      buildSummaryCard('Confirmadas', confirmedRegistrations, 'asistencias confirmadas'),
    ],
    charts: {
      eventsByStatus: buildChartSeries(
        ['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'].map((status) => ({
          label: status,
          value: statusMap[status] || 0,
        }))
      ),
      topEvents: buildChartSeries(
        topEvents.map((event) => ({
          label: event.title,
          value: event.registrationsCount,
        }))
      ),
    },
  };
};

const getUserDashboard = async (userId) => {
  const confirmedFilter = { user: userId, status: 'CONFIRMED' };
  const cancelledFilter = { user: userId, status: 'CANCELLED' };
  const registeredEventIds = await Registration.find(confirmedFilter).distinct('event');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const historyFilter = {
    _id: { $in: registeredEventIds },
    $or: [
      { status: 'FINISHED' },
      { date: { $lt: today } },
    ],
  };
  const upcomingFilter = {
    _id: { $in: registeredEventIds },
    status: 'PUBLISHED',
    date: { $gte: today },
  };

  const [
    confirmedRegistrations,
    cancelledRegistrations,
    favorites,
    unreadNotifications,
    upcomingCount,
    upcomingActivities,
    historyCount,
    historyActivities,
    recentNotifications,
    upcomingByMonth,
  ] = await Promise.all([
    Registration.countDocuments(confirmedFilter),
    Registration.countDocuments(cancelledFilter),
    Favorite.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, read: false }),
    Event.countDocuments(upcomingFilter),
    Event.find(upcomingFilter)
      .select('title date time location image category')
      .populate('category', 'name')
      .sort({ date: 1 })
      .limit(3),
    Event.countDocuments(historyFilter),
    Event.find(historyFilter)
      .select('title date time location image category status')
      .populate('category', 'name')
      .sort({ date: -1 })
      .limit(5),
    Notification.find({ user: userId })
      .select('type message read event createdAt')
      .populate('event', 'title date status')
      .sort({ createdAt: -1 })
      .limit(5),
    Registration.aggregate([
      {
        $match: {
          user: userId,
          status: 'CONFIRMED',
        },
      },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDetails',
        },
      },
      { $unwind: '$eventDetails' },
      {
        $group: {
          _id: { month: { $month: '$eventDetails.date' } },
          total: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]),
  ]);

  const monthlySummary = monthNames.map((month, index) => ({
    label: month,
    value: upcomingByMonth.find((entry) => entry._id.month === index + 1)?.total || 0,
  }));

  return {
    role: 'USER',
    generatedAt: new Date().toISOString(),
    stats: {
      registeredActivities: confirmedRegistrations,
      confirmedRegistrations,
      cancelledRegistrations,
      favorites,
      history: historyCount,
      notifications: unreadNotifications,
      unreadNotifications,
      upcomingActivities: upcomingCount,
    },
    summary: [
      buildSummaryCard('Inscripciones', confirmedRegistrations, 'confirmadas'),
      buildSummaryCard('Favoritos', favorites, 'eventos guardados'),
      buildSummaryCard('Historial', historyCount, 'actividades finalizadas'),
      buildSummaryCard('Notificaciones', unreadNotifications, 'sin leer'),
      buildSummaryCard('Próximos', upcomingCount, 'eventos por asistir'),
    ],
    charts: {
      activityOverview: buildChartSeries(
        [
          { label: 'Inscripciones', value: confirmedRegistrations },
          { label: 'Favoritos', value: favorites },
          { label: 'No leídas', value: unreadNotifications },
        ]
      ),
      upcomingByMonth: buildChartSeries(monthlySummary),
    },
    upcomingActivities,
    historyActivities,
    recentNotifications,
  };
};

// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.status(200).json(await getAdminDashboard());
    }

    if (req.user.role === 'ORGANIZER') {
      return res.status(200).json(await getOrganizerDashboard(req.user.id));
    }

    if (req.user.role === 'USER') {
      return res.status(200).json(await getUserDashboard(req.user.id));
    }

    return res.status(403).json({ message: 'El rol del usuario no tiene acceso al dashboard.' });
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar el dashboard.' });
  }
};

module.exports = { getDashboard, buildChartSeries };
