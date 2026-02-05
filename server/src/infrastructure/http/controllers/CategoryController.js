import CategoryRepository from "../../database/repositories/CategoryRepository.js";
import AuditService from "../../services/audit.service.js";

/**
 * CategoryController - Hexagonal Architecture
 * Capa: Infrastructure/HTTP
 * Responsabilidad: Manejar peticiones HTTP relacionadas con categorías
 */
class CategoryController {
  /**
   * Obtener todas las categorías del negocio
   * @route GET /api/v2/categories
   */
  async getAll(req, res) {
    try {
      const businessId =
        req.businessId || req.headers["x-business-id"] || req.query.businessId;

      if (!businessId) {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      const categories = await CategoryRepository.findByBusiness(businessId);

      res.json({
        success: true,
        data: categories,
        count: categories.length,
      });
    } catch (error) {
      console.error("❌ Error al obtener categorías:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las categorías",
      });
    }
  }

  /**
   * Obtener una categoría por ID
   * @route GET /api/v2/categories/:id
   */
  async getById(req, res) {
    try {
      const businessId =
        req.businessId || req.headers["x-business-id"] || req.query.businessId;

      if (!businessId) {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      const category = await CategoryRepository.findById(
        req.params.id,
        businessId,
      );

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Categoría no encontrada",
        });
      }

      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error("❌ Error al obtener categoría:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener la categoría",
      });
    }
  }

  /**
   * Crear una nueva categoría
   * @route POST /api/v2/categories
   */
  async create(req, res) {
    try {
      const { name, description } = req.body;
      const businessId =
        req.businessId || req.headers["x-business-id"] || req.query.businessId;

      if (!businessId) {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message: "El nombre de la categoría es requerido",
        });
      }

      // Verificar duplicados
      const existing = await CategoryRepository.findByName(name, businessId);
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Ya existe una categoría con ese nombre",
        });
      }

      // Crear categoría
      const category = await CategoryRepository.create({
        name: name.trim(),
        description: description?.trim() || "",
        business: businessId,
      });

      // Auditoría
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

      res.status(201).json({
        success: true,
        data: category,
        message: "Categoría creada exitosamente",
      });
    } catch (error) {
      console.error("❌ Error al crear categoría:", error);
      res.status(500).json({
        success: false,
        message: "Error al crear la categoría",
      });
    }
  }

  /**
   * Actualizar una categoría
   * @route PUT /api/v2/categories/:id
   */
  async update(req, res) {
    try {
      const { name, description } = req.body;
      const businessId =
        req.businessId || req.headers["x-business-id"] || req.query.businessId;

      if (!businessId) {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      // Verificar que existe
      const existing = await CategoryRepository.findById(
        req.params.id,
        businessId,
      );
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Categoría no encontrada",
        });
      }

      // Verificar nombre duplicado (si se está cambiando)
      if (name && name !== existing.name) {
        const hasDuplicate = await CategoryRepository.existsDuplicateName(
          name,
          businessId,
          req.params.id,
        );
        if (hasDuplicate) {
          return res.status(400).json({
            success: false,
            message: "Ya existe una categoría con ese nombre",
          });
        }
      }

      // Actualizar
      const updates = {};
      if (name?.trim()) updates.name = name.trim();
      if (description !== undefined)
        updates.description = description?.trim() || "";

      const category = await CategoryRepository.update(
        req.params.id,
        businessId,
        updates,
      );

      // Auditoría
      await AuditService.log({
        user: req.user,
        action: "category_updated",
        module: "categories",
        description: `Categoría "${category.name}" actualizada`,
        entityType: "Category",
        entityId: category._id,
        entityName: category.name,
        oldValues: existing,
        newValues: category,
        business: businessId,
        req,
      });

      res.json({
        success: true,
        data: category,
        message: "Categoría actualizada exitosamente",
      });
    } catch (error) {
      console.error("❌ Error al actualizar categoría:", error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar la categoría",
      });
    }
  }

  /**
   * Eliminar una categoría
   * @route DELETE /api/v2/categories/:id
   */
  async delete(req, res) {
    try {
      const businessId =
        req.businessId || req.headers["x-business-id"] || req.query.businessId;

      if (!businessId) {
        return res.status(400).json({ message: "Falta x-business-id" });
      }

      // Verificar que existe
      const category = await CategoryRepository.findById(
        req.params.id,
        businessId,
      );
      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Categoría no encontrada",
        });
      }

      // Verificar productos asociados
      const productsCount = await CategoryRepository.countProductsByCategory(
        req.params.id,
        businessId,
      );

      if (productsCount > 0) {
        return res.status(400).json({
          success: false,
          message: `No se puede eliminar la categoría porque tiene ${productsCount} producto(s) asociado(s)`,
        });
      }

      // Eliminar
      await CategoryRepository.delete(req.params.id, businessId);

      // Auditoría
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

      res.json({
        success: true,
        message: "Categoría eliminada exitosamente",
      });
    } catch (error) {
      console.error("❌ Error al eliminar categoría:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar la categoría",
      });
    }
  }
}

export default new CategoryController();
