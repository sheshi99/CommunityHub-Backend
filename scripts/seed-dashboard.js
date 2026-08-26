/**
 * Genera datos de prueba para los dashboards.
 * Uso: npm run seed:dashboard
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const Favorite = require('../src/models/Favorite');
const Notification = require('../src/models/Notification');

const CATEGORIAS = [
  { name: 'Tecnologia', description: 'Charlas, talleres y meetups de tecnologia' },
  { name: 'Deportes', description: 'Actividades deportivas y recreativas' },
  { name: 'Cultura', description: 'Arte, musica y eventos culturales' },
  { name: 'Educacion', description: 'Cursos, talleres y capacitaciones' },
  { name: 'Comunidad', description: 'Actividades vecinales y sociales' },
];

// Fecha fija para generar siempre la misma demostracion.
const today = new Date('2026-08-26T09:00:00-06:00');

const monthsAgo = (n, day = 15) => {
  const d = new Date(today);
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return d;
};

const daysFromNow = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};

// Calcula una fecha anterior a otra.
const daysBefore = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
};

// Calcula una fecha anterior al dia de la demostracion.
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
};

const findRequiredUser = async (envVar, expectedRole) => {
  const email = process.env[envVar];
  if (!email) {
    throw new Error(
      `Falta ${envVar} en el .env. Define ahi el email de la cuenta ${expectedRole} que ya existe en la base.`
    );
  }
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new Error(`No existe ningun usuario con email "${email}" (variable ${envVar}).`);
  }
  if (user.role !== expectedRole) {
    throw new Error(
      `El usuario "${email}" tiene rol ${user.role}, se esperaba ${expectedRole}. Revisa ${envVar}.`
    );
  }
  return user;
};

const ensureCategories = async () => {
  const map = {};
  for (const categoria of CATEGORIAS) {
    let doc = await Category.findOne({ name: categoria.name });
    if (!doc) {
      doc = await Category.create(categoria);
      console.log(`Categoria creada: ${doc.name}`);
    }
    map[categoria.name] = doc;
  }
  return map;
};

// Permite asignar fechas de creacion historicas.
const ensureEvent = async ({ createdAt, ...data }) => {
  let event = await Event.findOne({ title: data.title, organizer: data.organizer });
  if (event) {
    // Restaura los datos esperados en cada ejecucion.
    await Event.collection.updateOne(
      { _id: event._id },
      { $set: { ...data, ...(createdAt ? { createdAt, updatedAt: createdAt } : {}) } }
    );
    event = await Event.findById(event._id);
    return event;
  }
  event = await Event.create(data);
  if (createdAt) {
    // El driver nativo permite modificar el createdAt protegido por Mongoose.
    await Event.collection.updateOne({ _id: event._id }, { $set: { createdAt, updatedAt: createdAt } });
  }
  console.log(`Evento creado: ${event.title} (${event.status})`);
  return event;
};

const ensureRegistration = async (userId, eventId, status, createdAt, updatedAt = createdAt) => {
  const existing = await Registration.findOne({ user: userId, event: eventId });
  if (existing) {
    await Registration.collection.updateOne(
      { _id: existing._id },
      { $set: { status, createdAt, updatedAt } }
    );
    return Registration.findById(existing._id);
  }
  const reg = await Registration.create({ user: userId, event: eventId, status });
  await Registration.collection.updateOne({ _id: reg._id }, { $set: { createdAt, updatedAt } });
  console.log(`Inscripcion creada (${status}): usuario ${userId} -> evento ${eventId}`);
  return reg;
};

const ensureFavorite = async (userId, eventId) => {
  const existing = await Favorite.findOne({ user: userId, event: eventId });
  if (existing) {
    return existing;
  }
  const fav = await Favorite.create({ user: userId, event: eventId });
  console.log(`Favorito creado: usuario ${userId} -> evento ${eventId}`);
  return fav;
};

// Deduplica por usuario, evento y tipo, como establece el contrato Lambda.
const ensureNotification = async ({ createdAt, ...data }) => {
  const existing = await Notification.findOne({
    user: data.user,
    event: data.event || null,
    type: data.type,
  });
  if (existing) {
    await Notification.collection.updateOne(
      { _id: existing._id },
      { $set: { ...data, ...(createdAt ? { createdAt, updatedAt: createdAt } : {}) } }
    );
    return Notification.findById(existing._id);
  }
  const notif = await Notification.create(data);
  if (createdAt) {
    await Notification.collection.updateOne({ _id: notif._id }, { $set: { createdAt, updatedAt: createdAt } });
  }
  console.log(`Notificacion creada (${notif.type}) para ${notif.user}`);
  return notif;
};

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta definida en las variables de entorno.');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await findRequiredUser('SEED_ADMIN_EMAIL', 'ADMIN');
  const organizer = await findRequiredUser('SEED_ORGANIZER_EMAIL', 'ORGANIZER');
  const user = await findRequiredUser('SEED_USER_EMAIL', 'USER');

  const categories = await ensureCategories();

  const reactWorkshopDate = monthsAgo(5);
  const torneoFutbolDate = monthsAgo(3);
  const feriaCulturalDate = monthsAgo(2);
  const cursoEmprendimientoDate = monthsAgo(1);

  const events = {
    reactWorkshop: await ensureEvent({
      title: 'Taller de React Avanzado',
      description: 'Patrones avanzados de React para equipos de producto.',
      category: categories['Tecnologia']._id,
      date: reactWorkshopDate,
      time: '18:00',
      location: 'Centro Comunitario Norte',
      maxCapacity: 30,
      organizer: organizer._id,
      status: 'FINISHED',
      createdAt: daysBefore(reactWorkshopDate, 21), // creado 3 semanas antes de que ocurriera
    }),
    torneoFutbol: await ensureEvent({
      title: 'Torneo de Futbol Comunitario',
      description: 'Torneo relampago entre equipos del barrio.',
      category: categories['Deportes']._id,
      date: torneoFutbolDate,
      time: '09:00',
      location: 'Polideportivo Municipal',
      maxCapacity: 40,
      organizer: organizer._id,
      status: 'FINISHED',
      createdAt: daysBefore(torneoFutbolDate, 25),
    }),
    feriaCultural: await ensureEvent({
      title: 'Feria Cultural de Verano',
      description: 'Muestra de arte, musica y gastronomia local.',
      category: categories['Cultura']._id,
      date: feriaCulturalDate,
      time: '16:00',
      location: 'Plaza Central',
      maxCapacity: 25,
      organizer: organizer._id,
      status: 'FINISHED',
      createdAt: daysBefore(feriaCulturalDate, 15),
    }),
    cursoEmprendimiento: await ensureEvent({
      title: 'Curso de Emprendimiento',
      description: 'Introduccion a emprendimiento para vecinos.',
      category: categories['Educacion']._id,
      date: cursoEmprendimientoDate,
      time: '19:00',
      location: 'Biblioteca Popular',
      maxCapacity: 20,
      organizer: organizer._id,
      status: 'CANCELLED',
      createdAt: daysBefore(cursoEmprendimientoDate, 18),
    }),
    encuentroVecinal: await ensureEvent({
      title: 'Encuentro Vecinal de Agosto',
      description: 'Reunion mensual de la junta vecinal.',
      category: categories['Comunidad']._id,
      date: daysFromNow(3), // sabado 29 de agosto, el proximo evento de la demo
      time: '17:30',
      location: 'Salon Comunal',
      // Capacidad igual al total de inscripciones de prueba.
      maxCapacity: 2,
      organizer: organizer._id,
      status: 'PUBLISHED',
      // Garantiza que el evento exista antes de sus inscripciones.
      createdAt: daysAgo(6),
    }),
    hackathon: await ensureEvent({
      title: 'Hackathon CommunityHub',
      description: 'Maraton de 24 horas construyendo para la comunidad.',
      category: categories['Tecnologia']._id,
      date: daysFromNow(20),
      time: '08:00',
      location: 'Campus Tecnologico',
      maxCapacity: 50,
      organizer: organizer._id,
      status: 'PUBLISHED',
      createdAt: daysAgo(10),
    }),
    maratonOtono: await ensureEvent({
      title: 'Maraton de Otono',
      description: 'Carrera 10K abierta a toda la comunidad.',
      category: categories['Deportes']._id,
      date: daysFromNow(35),
      time: '07:00',
      location: 'Parque Metropolitano',
      maxCapacity: 100,
      organizer: organizer._id,
      status: 'PUBLISHED',
      createdAt: daysAgo(15),
    }),
    conferenciaSoftwareLibre: await ensureEvent({
      title: 'Conferencia de Software Libre',
      description: 'Charlas sobre codigo abierto y comunidad tech.',
      category: categories['Educacion']._id,
      date: daysFromNow(55),
      time: '10:00',
      location: 'Auditorio Central',
      maxCapacity: 60,
      organizer: organizer._id,
      status: 'DRAFT',
      createdAt: daysAgo(1),
    }),
  };

  // Fechas coherentes para inscripciones y sus notificaciones.
  const reactWorkshopRegAt = daysBefore(reactWorkshopDate, 10);
  const torneoFutbolRegAt = daysBefore(torneoFutbolDate, 5);
  const feriaCulturalUserRegAt = daysBefore(feriaCulturalDate, 3);
  const feriaCulturalAdminRegAt = daysBefore(feriaCulturalDate, 1);
  const encuentroVecinalUserRegAt = daysAgo(3);
  const encuentroVecinalAdminRegAt = daysAgo(2);
  const hackathonRegAt = daysAgo(4);
  const maratonOtonoConfirmedAt = daysAgo(12);
  const maratonOtonoCancelledAt = daysAgo(2);

  await ensureRegistration(user._id, events.reactWorkshop._id, 'CONFIRMED', reactWorkshopRegAt);
  await ensureNotification({
    user: user._id,
    event: events.reactWorkshop._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.reactWorkshop.title}" fue confirmada.`,
    read: true, // actividad ya finalizada hace meses, se asume leida
    createdAt: reactWorkshopRegAt,
  });

  await ensureRegistration(user._id, events.torneoFutbol._id, 'CONFIRMED', torneoFutbolRegAt);
  await ensureNotification({
    user: user._id,
    event: events.torneoFutbol._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.torneoFutbol.title}" fue confirmada.`,
    read: true,
    createdAt: torneoFutbolRegAt,
  });

  await ensureRegistration(user._id, events.feriaCultural._id, 'CONFIRMED', feriaCulturalUserRegAt);
  await ensureNotification({
    user: user._id,
    event: events.feriaCultural._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.feriaCultural.title}" fue confirmada.`,
    read: true,
    createdAt: feriaCulturalUserRegAt,
  });

  await ensureRegistration(user._id, events.encuentroVecinal._id, 'CONFIRMED', encuentroVecinalUserRegAt);
  await ensureNotification({
    user: user._id,
    event: events.encuentroVecinal._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.encuentroVecinal.title}" fue confirmada.`,
    read: false, // actividad proxima, todavia sin leer
    createdAt: encuentroVecinalUserRegAt,
  });

  await ensureRegistration(user._id, events.hackathon._id, 'CONFIRMED', hackathonRegAt);
  await ensureNotification({
    user: user._id,
    event: events.hackathon._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.hackathon.title}" fue confirmada.`,
    read: false,
    createdAt: hackathonRegAt,
  });

  // Conserva la notificacion original de una inscripcion luego cancelada.
  await ensureRegistration(user._id, events.maratonOtono._id, 'CANCELLED', maratonOtonoConfirmedAt, maratonOtonoCancelledAt);
  await ensureNotification({
    user: user._id,
    event: events.maratonOtono._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.maratonOtono.title}" fue confirmada.`,
    read: true,
    createdAt: maratonOtonoConfirmedAt,
  });

  // El admin aporta variedad a las estadisticas globales.
  await ensureRegistration(admin._id, events.feriaCultural._id, 'CONFIRMED', feriaCulturalAdminRegAt);
  await ensureNotification({
    user: admin._id,
    event: events.feriaCultural._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.feriaCultural.title}" fue confirmada.`,
    read: true,
    createdAt: feriaCulturalAdminRegAt,
  });

  // Completa el cupo del encuentro vecinal.
  await ensureRegistration(admin._id, events.encuentroVecinal._id, 'CONFIRMED', encuentroVecinalAdminRegAt);
  await ensureNotification({
    user: admin._id,
    event: events.encuentroVecinal._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.encuentroVecinal.title}" fue confirmada.`,
    read: false,
    createdAt: encuentroVecinalAdminRegAt,
  });

  // Favoritos de prueba del usuario.
  await ensureFavorite(user._id, events.feriaCultural._id);
  await ensureFavorite(user._id, events.hackathon._id);
  await ensureFavorite(user._id, events.maratonOtono._id);

  // Simula la notificacion que la Lambda genera al llenar un evento.
  await ensureNotification({
    user: organizer._id,
    event: events.encuentroVecinal._id,
    type: 'EVENT_CAPACITY_REACHED',
    message: `La actividad "${events.encuentroVecinal.title}" alcanzo su capacidad maxima de ${events.encuentroVecinal.maxCapacity} participantes.`,
    read: false,
    createdAt: encuentroVecinalAdminRegAt,
  });

  await mongoose.disconnect();
  console.log('\nSeeder de dashboard completado.');
};

run().catch((err) => {
  console.error('Error ejecutando el seeder:', err.message);
  process.exit(1);
});
