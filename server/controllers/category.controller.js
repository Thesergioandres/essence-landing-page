import Category from "../models/Category.js";
import Product from "../models/Product.js";

// Obtener todas las categorías
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    res.status(500).json({ message: "Error al obtener las categorías" });
  }
};

// Obtener una categoría por ID
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json(category);
  } catch (error) {
    console.error("Error al obtener categoría:", error);
    res.status(500).json({ message: "Error al obtener la categoría" });
  }
};

// Crear una nueva categoría
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Verificar si ya existe una categoría con ese nombre
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res
        .status(400)
        .json({ message: "Ya existe una categoría con ese nombre" });
    }

    const category = await Category.create({
      name,
      description,
    });

    res.status(201).json(category);
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ message: "Error al crear la categoría" });
  }
};

// Actualizar una categoría
export const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Verificar si existe otra categoría con el mismo nombre
    if (name) {
      const existingCategory = await Category.findOne({
        name,
        _id: { $ne: req.params.id },
      });

      if (existingCategory) {
        return res
          .status(400)
          .json({ message: "Ya existe una categoría con ese nombre" });
      }
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json(category);
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar la categoría" });
  }
};

// Eliminar una categoría
export const deleteCategory = async (req, res) => {
  try {
    // Verificar si hay productos asociados a esta categoría
    const productsCount = await Product.countDocuments({
      category: req.params.id,
    });

    if (productsCount > 0) {
      return res.status(400).json({
        message: `No se puede eliminar la categoría porque tiene ${productsCount} producto(s) asociado(s)`,
      });
    }

    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json({ message: "Categoría eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ message: "Error al eliminar la categoría" });
  }
};
