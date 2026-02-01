import Category from "../models/Category.js";
import Product from "../models/Product.js";
import AuditService from "../services/audit.service.js";

const resolveBusinessId = (req) =>
  req.businessId || req.headers["x-business-id"] || req.query.businessId;

// Obtener todas las categorías
export const getCategories = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const categories = await Category.find({ business: businessId }).sort({
      name: 1,
    });
    res.json(categories);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    res.status(500).json({ message: "Error al obtener las categorías" });
  }
};

// Obtener una categoría por ID
export const getCategoryById = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    const category = await Category.findOne({
      _id: req.params.id,
      business: businessId,
    });

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
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // Verificar si ya existe una categoría con ese nombre
    const existingCategory = await Category.findOne({
      name,
      business: businessId,
    });
    if (existingCategory) {
      return res
        .status(400)
        .json({ message: "Ya existe una categoría con ese nombre" });
    }

    const category = await Category.create({
      name,
      description,
      business: businessId,
    });

    await AuditService.log({
      user: req.user,
      action: "category_created",
      module: "categories",
      description: `Categoría "${category.name}" creada`,
      entityType: "Category",
      entityId: category._id,
      entityName: category.name,
      newValues: category,
      business: businessId,
      req,
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
    const businessId = resolveBusinessId(req);

    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // Verificar si existe otra categoría con el mismo nombre
    if (name) {
      const existingCategory = await Category.findOne({
        name,
        _id: { $ne: req.params.id },
        business: businessId,
      });

      if (existingCategory) {
        return res
          .status(400)
          .json({ message: "Ya existe una categoría con ese nombre" });
      }
    }

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, business: businessId },
      { name, description },
      { new: true, runValidators: true },
    );

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    await AuditService.log({
      user: req.user,
      action: "category_updated",
      module: "categories",
      description: `Categoría "${category.name}" actualizada`,
      entityType: "Category",
      entityId: category._id,
      entityName: category.name,
      newValues: category,
      business: businessId,
      req,
    });

    res.json(category);
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar la categoría" });
  }
};

// Eliminar una categoría
export const deleteCategory = async (req, res) => {
  try {
    const businessId = resolveBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: "Falta x-business-id" });
    }

    // Verificar si hay productos asociados a esta categoría
    const productsCount = await Product.countDocuments({
      category: req.params.id,
      business: businessId,
    });

    if (productsCount > 0) {
      return res.status(400).json({
        message: `No se puede eliminar la categoría porque tiene ${productsCount} producto(s) asociado(s)`,
      });
    }

    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      business: businessId,
    });

    if (!category) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    await AuditService.log({
      user: req.user,
      action: "category_deleted",
      module: "categories",
      description: `Categoría "${category.name}" eliminada`,
      entityType: "Category",
      entityId: category._id,
      entityName: category.name,
      oldValues: category,
      business: businessId,
      req,
    });

    res.json({ message: "Categoría eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ message: "Error al eliminar la categoría" });
  }
};
