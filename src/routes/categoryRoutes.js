const express = require('express');
const { getCategories } = require('../controllers/categoryController');

const router = express.Router();

// Solo lectura: las categorias son datos fijos cargados por seeder,
// no tienen CRUD propio (ver scripts/seed-categories.js)
router.get('/', getCategories);

module.exports = router;
