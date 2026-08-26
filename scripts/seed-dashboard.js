/**
 * Seeder de datos de prueba para los 3 dashboards (ADMIN, ORGANIZER, USER).
 * Permite tener un conjunto de eventos, inscripciones, favoritos y notificaciones
 * que genere datos estadisticos y de tendencia para mostrar en los dashboards.
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

// Fecha fija de la demostracion: miercoles 26 de agosto de 2026, 9:00 a. m.
// en Costa Rica. No se usa el reloj del equipo para que los datos sean los
// mismos durante la presentacion y cada vez que se vuelva a ejecutar el seed.
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

// N dias antes de una fecha dada -- se usa para fijar el createdAt de los
// eventos "historicos" antes de su date, tal como exige validateEventData().
const daysBefore = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d;
};

// N dias antes de "hoy" (a diferencia de monthsAgo, que fija un dia-del-mes
// puntual, este offset es siempre relativo a "today" -- por eso es el que se
// usa para timestamps que deben quedar DESPUES del createdAt de un evento
// "futuro", sin importar que dia del mes se corra el seeder).
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

// `createdAt` es opcional: si se pasa, sobreescribe el timestamp automatico
// para que un evento "historico" quede con una fecha de creacion anterior a
// su `date`, como habria pasado si se hubiera creado de verdad via la API
// (que rechaza fecha pasada) y el tiempo simplemente hubiera transcurrido.
const ensureEvent = async ({ createdAt, ...data }) => {
  let event = await Event.findOne({ title: data.title, organizer: data.organizer });
  if (event) {
    // Una nueva ejecucion debe dejar la misma fotografia de la demo, aunque
    // el evento ya hubiera sido creado por una ejecucion anterior.
    await Event.collection.updateOne(
      { _id: event._id },
      { $set: { ...data, ...(createdAt ? { createdAt, updatedAt: createdAt } : {}) } }
    );
    event = await Event.findById(event._id);
    return event;
  }
  event = await Event.create(data);
  if (createdAt) {
    // Mongoose 8 protege "createdAt" incluso pasando {timestamps:false} en
    // updateOne: silenciosamente no lo cambia. Se usa el driver nativo
    // (.collection) para saltear ese comportamiento y forzar la fecha real.
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

// Misma clave de deduplicacion (user + event + type) que exige el contrato
// de la Lambda en docs/LAMBDA_CAPACITY_CONTRACT.md. `createdAt` es opcional,
// igual que en ensureEvent/ensureRegistration, para poder fechar la
// notificacion en el mismo momento que la accion real que la origino.
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
      // capacidad chica y a proposito IGUAL a la cantidad de confirmados que
      // se crean mas abajo, para que quede realmente lleno (no "casi").
      maxCapacity: 2,
      organizer: organizer._id,
      status: 'PUBLISHED',
      // createdAt explicito para que las inscripciones de mas abajo (que
      // pasan por daysAgo, no por daysBefore) queden garantizadas DESPUES de
      // que el evento exista, sin importar que dia del mes se corra el seed.
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

  // Inscripciones del usuario USER: historial + proximos + una cancelada.
  // Cada createdAt queda despues del createdAt del evento y antes/en su date
  // (te registras despues de que el evento existe y, salvo la cancelada,
  // antes de que ocurra). El mismo timestamp se reutiliza para la
  // notificacion REGISTRATION_CONFIRMED de abajo, tal como
  // registrationController.registerForEvent() crea ambas cosas juntas en la
  // misma transaccion.
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

  // Se registro (confirmada, con su notificacion) y la cancelo despues
  // (createdAt != updatedAt). cancelRegistration() no borra la notificacion
  // original ni crea una nueva para el propio usuario, asi que la
  // REGISTRATION_CONFIRMED queda tal cual con la fecha de la confirmacion.
  await ensureRegistration(user._id, events.maratonOtono._id, 'CANCELLED', maratonOtonoConfirmedAt, maratonOtonoCancelledAt);
  await ensureNotification({
    user: user._id,
    event: events.maratonOtono._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.maratonOtono.title}" fue confirmada.`,
    read: true,
    createdAt: maratonOtonoConfirmedAt,
  });

  // El admin tambien participa en algunos eventos, para que el total global
  // de inscripciones (dashboard ADMIN) no dependa de un solo usuario y la
  // tendencia mensual tenga mas puntos. El organizador NO se inscribe en
  // ningun evento: registerForEvent() prohibe inscribirse a la propia
  // actividad (ver registrationController.js) y aqui todos los eventos son
  // suyos, asi que nunca podria ser participante de ninguno.
  await ensureRegistration(admin._id, events.feriaCultural._id, 'CONFIRMED', feriaCulturalAdminRegAt);
  await ensureNotification({
    user: admin._id,
    event: events.feriaCultural._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.feriaCultural.title}" fue confirmada.`,
    read: true,
    createdAt: feriaCulturalAdminRegAt,
  });

  // Completa el cupo (2/2) de "Encuentro Vecinal de Agosto" junto con el
  // registro del usuario -> dispara realmente notifyOrganizerIfFull().
  await ensureRegistration(admin._id, events.encuentroVecinal._id, 'CONFIRMED', encuentroVecinalAdminRegAt);
  await ensureNotification({
    user: admin._id,
    event: events.encuentroVecinal._id,
    type: 'REGISTRATION_CONFIRMED',
    message: `Tu inscripcion a "${events.encuentroVecinal.title}" fue confirmada.`,
    read: false,
    createdAt: encuentroVecinalAdminRegAt,
  });

  // Favoritos del usuario (addFavorite no restringe por status/fecha del
  // evento, solo que exista, asi que cualquier evento existente es valido).
  await ensureFavorite(user._id, events.feriaCultural._id);
  await ensureFavorite(user._id, events.hackathon._id);
  await ensureFavorite(user._id, events.maratonOtono._id);

  // El sistema real genera notificaciones desde tres lugares:
  // - registrationController.registerForEvent() crea REGISTRATION_CONFIRMED
  //   al confirmar una inscripcion (replicado arriba, junto a cada
  //   ensureRegistration en estado CONFIRMED).
  // - eventController.updateEvent() crea EVENT_CANCELLED / EVENT_UPDATED
  //   cuando se cancela o edita una actividad PUBLISHED con inscriptos.
  //   Ningun evento de este seed cambia de estado despues de creado (se
  //   crean ya con su status final), asi que ese caso no aplica aqui.
  // - La Lambda externa (docs/LAMBDA_CAPACITY_CONTRACT.md) crea
  //   EVENT_CAPACITY_REACHED cuando una inscripcion ocupa el ultimo cupo,
  //   como el de "Encuentro Vecinal de Agosto" (2/2). Se replica a mano
  //   abajo, con el mismo formato de mensaje que especifica ese contrato,
  //   porque el seeder no invoca la Lambda real.
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
