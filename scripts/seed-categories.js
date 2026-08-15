/**
 * Seeder de categorias fijas. Las categorias no tienen CRUD propio (solo
 * GET /api/categories) -- se cargan una vez con este script.
 *
 * Uso: node scripts/seed-categories.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');

const CATEGORIAS = [
  { name: 'Tecnologia', description: 'Charlas, talleres y meetups de tecnologia' },
  { name: 'Deportes', description: 'Actividades deportivas y recreativas' },
  { name: 'Cultura', description: 'Arte, musica y eventos culturales' },
  { name: 'Educacion', description: 'Cursos, talleres y capacitaciones' },
  { name: 'Comunidad', description: 'Actividades vecinales y sociales' },
];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const categoria of CATEGORIAS) {
    const existente = await Category.findOne({ name: categoria.name });
    if (existente) {
      console.log(`Ya existia: ${categoria.name}`);
      continue;
    }
    const creada = await Category.create(categoria);
    console.log(`Creada: ${creada.name} (${creada._id})`);
  }

  await mongoose.disconnect();
  console.log('Listo.');
};

run().catch((err) => {
  console.error('Error ejecutando el seeder:', err.message);
  process.exit(1);
});
