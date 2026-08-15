const Category = require('../models/Category');

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ message: 'Error interno del servidor al consultar las categorias.' });
  }
};

module.exports = { getCategories };
