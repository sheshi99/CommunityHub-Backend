const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Favorite = require('../models/Favorite');
const Notification = require('../models/Notification');

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const buildChartSeries = (items, colors = []) => ({
  labels: items.map((item) => item.label),
  datasets: [
    {
      label: 'Cantidad',
      data: items.map((item) => item.value),
      backgroundColor: colors.length ? colors : ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
      borderRadius: 8,
    },
  ],
});

const buildSummaryCard = (label, value, hint = '', color = '#4F46E5') => ({
  label,
  value,
  hint,
  color,
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
      buildSummaryCard('Usuarios', registeredUsers, 'Total del sistema', '#4F46E5'),
      buildSummaryCard('Organizadores', organizers, 'roles activos', '#8B5CF6'),
      buildSummaryCard('Eventos', activities, 'actividades registradas', '#10B981'),
      buildSummaryCard('Inscripciones', registrations, 'total confirmadas', '#F59E0B'),
    ],
    charts: {
      usersByRole: buildChartSeries(
        ['ADMIN', 'ORGANIZER', 'USER'].map((role) => ({
          label: role,
          value: roleMap[role] || 0,
        })),
        ['#4F46E5', '#8B5CF6', '#10B981']
      ),
      eventsByStatus: buildChartSeries(
        ['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'].map((status) => ({
          label: status,
          value: statusMap[status] || 0,
        })),
        ['#E2E8F0', '#22C55E', '#F97316', '#64748B']
      ),
      monthlyRegistrations: buildChartSeries(monthlyRegistrations, ['#06B6D4', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#FB7185']),
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
      buildSummaryCard('Eventos', activities, 'total creados', '#4F46E5'),
      buildSummaryCard('Publicados', activeActivities, 'activos en curso', '#10B981'),
      buildSummaryCard('Inscripciones', registrations, 'participantes totales', '#F59E0B'),
      buildSummaryCard('Confirmadas', confirmedRegistrations, 'asistencias confirmadas', '#22C55E'),
    ],
    charts: {
      eventsByStatus: buildChartSeries(
        ['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'].map((status) => ({
          label: status,
          value: statusMap[status] || 0,
        })),
        ['#E2E8F0', '#22C55E', '#F97316', '#64748B']
      ),
      topEvents: buildChartSeries(
        topEvents.map((event) => ({
          label: event.title,
          value: event.registrationsCount,
        })),
        ['#4F46E5', '#8B5CF6', '#10B981', '#F59E0B', '#06B6D4']
      ),
    },
  };
};

const getUserDashboard = async (userId) => {
  const confirmedFilter = { user: userId, status: 'CONFIRMED' };
  const cancelledFilter = { user: userId, status: 'CANCELLED' };
  const registeredEventIds = await Registration.find(confirmedFilter).distinct('event');

  const [
    confirmedRegistrations,
    cancelledRegistrations,
    favorites,
    unreadNotifications,
    upcomingActivities,
    upcomingByMonth,
  ] = await Promise.all([
    Registration.countDocuments(confirmedFilter),
    Registration.countDocuments(cancelledFilter),
    Favorite.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, read: false }),
    Event.find({
      _id: { $in: registeredEventIds },
      status: 'PUBLISHED',
      date: { $gte: new Date() },
    })
      .select('title date time location image category')
      .populate('category', 'name')
      .sort({ date: 1 })
      .limit(3),
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
      confirmedRegistrations,
      cancelledRegistrations,
      favorites,
      unreadNotifications,
      upcomingActivities: upcomingActivities.length,
    },
    summary: [
      buildSummaryCard('Inscripciones', confirmedRegistrations, 'confirmadas', '#4F46E5'),
      buildSummaryCard('Favoritos', favorites, 'eventos guardados', '#8B5CF6'),
      buildSummaryCard('Notificaciones', unreadNotifications, 'sin leer', '#F59E0B'),
      buildSummaryCard('Próximos', upcomingActivities.length, 'eventos por asistir', '#10B981'),
    ],
    charts: {
      activityOverview: buildChartSeries(
        [
          { label: 'Inscripciones', value: confirmedRegistrations },
          { label: 'Favoritos', value: favorites },
          { label: 'No leídas', value: unreadNotifications },
        ],
        ['#4F46E5', '#8B5CF6', '#F59E0B']
      ),
      upcomingByMonth: buildChartSeries(monthlySummary, ['#10B981', '#22C55E', '#8B5CF6', '#4F46E5', '#F59E0B', '#FB7185', '#06B6D4', '#3B82F6', '#A78BFA', '#14B8A6', '#F97316', '#94A3B8']),
    },
    upcomingActivities,
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
