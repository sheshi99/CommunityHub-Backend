const mongoose = require('mongoose');
const Category = require('../models/Category');
const Event = require('../models/Event');

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.status(200).json(categories);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor al consultar las categorias.' });
  }
};

// POST /api/categories (solo ADMIN)
const createCategory = async (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'El nombre de la categoria es obligatorio.' });
  }

  try {
    const nombreTrim = name.trim();

    // Chequeo case-insensitive para evitar duplicados como "Cultura" vs "cultura"
    const yaExiste = await Category.findOne({ name: new RegExp(`^${nombreTrim}$`, 'i') });
    if (yaExiste) {
      return res.status(409).json({ success: false, message: 'Ya existe una categoria con ese nombre.' });
    }

    const newCategory = new Category({
      name: nombreTrim,
      description: description ? description.trim() : '',
    });

    const savedCategory = await newCategory.save();

    return res.status(201)
      .location(`/api/categories/${savedCategory._id}`)
      .json(savedCategory);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Ya existe una categoria con ese nombre.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Error interno del servidor al crear la categoria.' });
  }
};

// PUT /api/categories/:id (solo ADMIN)
const updateCategory = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'El id de la categoria no es valido.' });
  }

  try {
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Categoria no encontrada.' });
    }

    const { name, description } = req.body;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ success: false, message: 'El nombre de la categoria no puede estar vacio.' });
      }
      const nombreTrim = name.trim();
      const yaExiste = await Category.findOne({
        name: new RegExp(`^${nombreTrim}$`, 'i'),
        _id: { $ne: id },
      });
      if (yaExiste) {
        return res.status(409).json({ success: false, message: 'Ya existe una categoria con ese nombre.' });
      }
      category.name = nombreTrim;
    }

    if (description !== undefined) {
      category.description = description.trim();
    }

    const updatedCategory = await category.save();

    return res.status(200).json(updatedCategory);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Ya existe una categoria con ese nombre.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar la categoria.' });
  }
};

// DELETE /api/categories/:id (solo ADMIN)
const deleteCategory = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'El id de la categoria no es valido.' });
  }

  try {
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Categoria no encontrada.' });
    }

    // No se permite borrar una categoria que ya tiene actividades asociadas,
    // para no dejar eventos con una referencia rota.
    const eventosAsociados = await Event.countDocuments({ category: id });
    if (eventosAsociados > 0) {
      return res.status(409).json({
        success: false,
        message: 'No se puede eliminar la categoria porque tiene actividades asociadas.',
      });
    }

    await category.deleteOne();

    return res.status(200).json({ message: 'Categoria eliminada correctamente.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar la categoria.' });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
