import Category from "../../../../models/Category.js";
import Product from "../models/Product.js";

/**
 * CategoryRepository - Hexagonal Architecture Pattern
 * Responsabilidad: Abstraer acceso a datos de categorías
 */
class CategoryRepository {
  /**
   * Obtener todas las categorías de un negocio
   * @param {string} businessId - ID del negocio
   * @returns {Promise<Array>} Categorías ordenadas alfabéticamente
   */
  async findByBusiness(businessId) {
    return Category.find({ business: businessId }).sort({ name: 1 }).lean();
  }

  /**
   * Obtener una categoría por ID
   * @param {string} categoryId - ID de la categoría
   * @param {string} businessId - ID del negocio
   * @returns {Promise<Object|null>} Categoría o null
   */
  async findById(categoryId, businessId) {
    return Category.findOne({
      _id: categoryId,
      business: businessId,
    }).lean();
  }

  /**
   * Buscar categoría por nombre (único por negocio)
   * @param {string} name - Nombre de la categoría
   * @param {string} businessId - ID del negocio
   * @returns {Promise<Object|null>} Categoría o null
   */
  async findByName(name, businessId) {
    return Category.findOne({
      name,
      business: businessId,
    }).lean();
  }

  /**
   * Crear una nueva categoría
   * @param {Object} categoryData - Datos de la categoría
   * @returns {Promise<Object>} Categoría creada
   */
  async create(categoryData) {
    const category = await Category.create(categoryData);
    return category.toObject();
  }

  /**
   * Actualizar una categoría
   * @param {string} categoryId - ID de la categoría
   * @param {string} businessId - ID del negocio
   * @param {Object} updates - Campos a actualizar
   * @returns {Promise<Object|null>} Categoría actualizada o null
   */
  async update(categoryId, businessId, updates) {
    return Category.findOneAndUpdate(
      { _id: categoryId, business: businessId },
      updates,
      { new: true, runValidators: true },
    ).lean();
  }

  /**
   * Eliminar una categoría
   * @param {string} categoryId - ID de la categoría
   * @param {string} businessId - ID del negocio
   * @returns {Promise<Object|null>} Categoría eliminada o null
   */
  async delete(categoryId, businessId) {
    return Category.findOneAndDelete({
      _id: categoryId,
      business: businessId,
    }).lean();
  }

  /**
   * Contar productos asociados a una categoría
   * @param {string} categoryId - ID de la categoría
   * @param {string} businessId - ID del negocio
   * @returns {Promise<number>} Número de productos
   */
  async countProductsByCategory(categoryId, businessId) {
    return Product.countDocuments({
      category: categoryId,
      business: businessId,
    });
  }

  /**
   * Verificar si existe otra categoría con el mismo nombre (excepto la actual)
   * @param {string} name - Nombre a verificar
   * @param {string} businessId - ID del negocio
   * @param {string} excludeCategoryId - ID de la categoría a excluir
   * @returns {Promise<boolean>} true si existe duplicado
   */
  async existsDuplicateName(name, businessId, excludeCategoryId) {
    const existing = await Category.findOne({
      name,
      _id: { $ne: excludeCategoryId },
      business: businessId,
    });
    return !!existing;
  }
}

export default new CategoryRepository();
