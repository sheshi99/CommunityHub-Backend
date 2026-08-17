/**
 * Seeder de datos de prueba para los 3 dashboards (ADMIN, ORGANIZER, USER).
 *
 * No crea usuarios nuevos: reutiliza las 3 cuentas ya existentes en la base
 * (una por cada rol) e inserta categorias, eventos, inscripciones, favoritos
 * y notificaciones alrededor de ellas para que /api/dashboard tenga algo
 * interesante que mostrar en cada rol.
 *
 * Los emails de esas cuentas NO se hardcodean aqui (son cuentas reales) --
 * se leen desde variables de entorno. Antes de correrlo agrega a tu .env:
 *
 *   SEED_ADMIN_EMAIL=...
 *   SEED_ORGANIZER_EMAIL=...
 *   SEED_USER_EMAIL=...
 *
 * Es idempotente: se puede correr varias veces sin duplicar datos.
 *
 * --- Fidelidad con las reglas reales del sistema --------------------------
 * Este script escribe directo en Mongo (no pasa por los controllers), asi
 * que reconstruye a mano los invariantes que la API si valida:
 *
 * 1. eventController.validateEventData() prohibe crear una actividad con
 *    fecha pasada. Los eventos "historicos" de este seeder SI tienen fecha
 *    pasada (para poblar historial y tendencias), pero a cada uno se le
 *    fuerza un `createdAt` anterior a su `date` -- exactamente el estado en
 *    el que quedarian si se hubieran creado con fecha futura y el tiempo
 *    simplemente hubiera pasado, que es la unica forma real de llegar ahi.
 * 2. registrationController.registerForEvent() prohibe inscribirse a la
 *    propia actividad, exige status PUBLISHED y valida el cupo -- las 3
 *    cosas se respetan aqui (ver comentarios en cada inscripcion). Ese mismo
 *    controller NO valida que la fecha del evento no haya pasado, asi que
 *    inscribir gente a "Feria Cultural de Verano" (PUBLISHED con fecha
 *    pasada) es un estado perfectamente alcanzable hoy mismo via la API real
 *    -- no es un atajo del seeder, es como se comporta el sistema.
 * 3. Notificaciones: revisando el repo, la UNICA notificacion que el sistema
 *    real llega a crear es "EVENT_CAPACITY_REACHED", y no la crea este
 *    backend sino la Lambda externa documentada en
 *    docs/LAMBDA_CAPACITY_CONTRACT.md, cuando una inscripcion confirmada
 *    ocupa el ultimo cupo. Los demas valores del enum (REGISTRATION_CONFIRMED,
 *    EVENT_REMINDER, EVENT_UPDATED, EVENT_CANCELLED, GENERAL) no tienen hoy
 *    ningun productor en el sistema, asi que este seeder NO los inventa.
 *    Por eso el dashboard de USER va a mostrar 0 notificaciones: es fiel a
 *    que, ahora mismo, nada en el sistema le crea notificaciones a un USER.
 *    Para que la notificacion de capacidad completa sea real de verdad, el
 *    evento chico ("Encuentro Vecinal de Agosto") se deja EXACTAMENTE lleno
 *    (confirmados === maxCapacity), que es la unica condicion bajo la que
 *    notifyOrganizerIfFull() la dispara.
 *
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

// Fecha de referencia = hoy, con hora fija para que los calculos de
// "proximo" / "historial" del dashboard sean deterministas.
const today = new Date();
today.setHours(9, 0, 0, 0);

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
    return event;
  }
  event = await Event.create(data);
  if (createdAt) {
    await Event.updateOne({ _id: event._id }, { createdAt, updatedAt: createdAt }, { timestamps: false });
  }
  console.log(`Evento creado: ${event.title} (${event.status})`);
  return event;
};

const ensureRegistration = async (userId, eventId, status, createdAt, updatedAt = createdAt) => {
  const existing = await Registration.findOne({ user: userId, event: eventId });
  if (existing) {
    return existing;
  }
  const reg = await Registration.create({ user: userId, event: eventId, status });
  await Registration.updateOne({ _id: reg._id }, { createdAt, updatedAt }, { timestamps: false });
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
// de la Lambda en docs/LAMBDA_CAPACITY_CONTRACT.md.
const ensureNotification = async (data) => {
  const existing = await Notification.findOne({
    user: data.user,
    event: data.event || null,
    type: data.type,
  });
  if (existing) {
    return existing;
  }
  const notif = await Notification.create(data);
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
      status: 'PUBLISHED', // fecha pasada -> cuenta como historial
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
      date: daysFromNow(9),
      time: '17:30',
      location: 'Salon Comunal',
      // capacidad chica y a proposito IGUAL a la cantidad de confirmados que
      // se crean mas abajo, para que quede realmente lleno (no "casi").
      maxCapacity: 2,
      organizer: organizer._id,
      status: 'PUBLISHED',
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
    }),
  };

  // Inscripciones del usuario USER: historial + proximos + una cancelada.
  // Cada createdAt queda despues del createdAt del evento y antes/en su date
  // (te registras despues de que el evento existe y, salvo la cancelada,
  // antes de que ocurra).
  await ensureRegistration(user._id, events.reactWorkshop._id, 'CONFIRMED', daysBefore(reactWorkshopDate, 10));
  await ensureRegistration(user._id, events.torneoFutbol._id, 'CONFIRMED', daysBefore(torneoFutbolDate, 5));
  await ensureRegistration(user._id, events.feriaCultural._id, 'CONFIRMED', daysBefore(feriaCulturalDate, 3));
  await ensureRegistration(user._id, events.encuentroVecinal._id, 'CONFIRMED', monthsAgo(0, 16));
  await ensureRegistration(user._id, events.hackathon._id, 'CONFIRMED', monthsAgo(0, 16));
  // Se registro hace un mes y la cancelo hace unos dias (createdAt != updatedAt).
  await ensureRegistration(user._id, events.maratonOtono._id, 'CANCELLED', monthsAgo(1, 20), monthsAgo(0, 10));

  // El admin tambien participa en algunos eventos, para que el total global
  // de inscripciones (dashboard ADMIN) no dependa de un solo usuario y la
  // tendencia mensual tenga mas puntos. El organizador NO se inscribe en
  // ningun evento: registerForEvent() prohibe inscribirse a la propia
  // actividad (ver registrationController.js) y aqui todos los eventos son
  // suyos, asi que nunca podria ser participante de ninguno.
  await ensureRegistration(admin._id, events.feriaCultural._id, 'CONFIRMED', daysBefore(feriaCulturalDate, 1));
  // Completa el cupo (2/2) de "Encuentro Vecinal de Agosto" junto con el
  // registro del usuario -> dispara realmente notifyOrganizerIfFull().
  await ensureRegistration(admin._id, events.encuentroVecinal._id, 'CONFIRMED', monthsAgo(0, 15));

  // Favoritos del usuario (addFavorite no restringe por status/fecha del
  // evento, solo que exista, asi que cualquier evento existente es valido).
  await ensureFavorite(user._id, events.feriaCultural._id);
  await ensureFavorite(user._id, events.hackathon._id);
  await ensureFavorite(user._id, events.maratonOtono._id);

  // Unica notificacion que el sistema real produce hoy: la Lambda de
  // capacidad completa, documentada en docs/LAMBDA_CAPACITY_CONTRACT.md,
  // con el mismo formato de mensaje que ese contrato especifica.
  await ensureNotification({
    user: organizer._id,
    event: events.encuentroVecinal._id,
    type: 'EVENT_CAPACITY_REACHED',
    message: `La actividad "${events.encuentroVecinal.title}" alcanzo su capacidad maxima de ${events.encuentroVecinal.maxCapacity} participantes.`,
    read: false,
  });

  await mongoose.disconnect();
  console.log('\nSeeder de dashboard completado.');
};

run().catch((err) => {
  console.error('Error ejecutando el seeder:', err.message);
  process.exit(1);
});
