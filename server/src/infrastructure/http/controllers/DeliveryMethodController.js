/**
 * DeliveryMethod Controller - HTTP Layer
 * Handles delivery method HTTP requests
 */

import deliveryMethodPersistenceUseCase from "../../../application/use-cases/repository-gateways/DeliveryMethodPersistenceUseCase.js";

class DeliveryMethodController {
  /**
   * GET /api/v2/delivery-methods
   * Get all delivery methods
   */
  async getAll(req, res) {
    try {
      const businessId = req.businessId;
      const { includeInactive } = req.query;

      const methods = await deliveryMethodPersistenceUseCase.findByBusiness(
        businessId,
        includeInactive === "true",
      );

      res.json({
        success: true,
        data: { deliveryMethods: methods },
      });
    } catch (error) {
      console.error("Error getting delivery methods:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener métodos de entrega",
      });
    }
  }

  /**
   * GET /api/v2/delivery-methods/:id
   * Get delivery method by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const method = await deliveryMethodPersistenceUseCase.findById(id, businessId);

      if (!method) {
        return res.status(404).json({
          success: false,
          message: "Método de entrega no encontrado",
        });
      }

      res.json({
        success: true,
        data: { deliveryMethod: method },
      });
    } catch (error) {
      console.error("Error getting delivery method:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener método de entrega",
      });
    }
  }

  /**
   * POST /api/v2/delivery-methods
   * Create new delivery method
   */
  async create(req, res) {
    try {
      const businessId = req.businessId;
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "El nombre es obligatorio",
        });
      }

      const method = await deliveryMethodPersistenceUseCase.create(
        businessId,
        req.body,
        req.user._id,
      );

      res.status(201).json({
        success: true,
        data: { deliveryMethod: method },
        message: "Método de entrega creado correctamente",
      });
    } catch (error) {
      console.error("Error creating delivery method:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al crear método de entrega",
      });
    }
  }

  /**
   * PUT /api/v2/delivery-methods/:id
   * Update delivery method
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const method = await deliveryMethodPersistenceUseCase.update(
        id,
        businessId,
        req.body,
        req.user._id,
      );

      if (!method) {
        return res.status(404).json({
          success: false,
          message: "Método de entrega no encontrado",
        });
      }

      res.json({
        success: true,
        data: { deliveryMethod: method },
        message: "Método de entrega actualizado correctamente",
      });
    } catch (error) {
      console.error("Error updating delivery method:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al actualizar método de entrega",
      });
    }
  }

  /**
   * DELETE /api/v2/delivery-methods/:id
   * Delete delivery method
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const deleted = await deliveryMethodPersistenceUseCase.delete(id, businessId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Método de entrega no encontrado",
        });
      }

      res.json({
        success: true,
        message: "Método de entrega eliminado correctamente",
      });
    } catch (error) {
      console.error("Error deleting delivery method:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar método de entrega",
      });
    }
  }

  /**
   * PUT /api/v2/delivery-methods/reorder
   * Reorder delivery methods
   */
  async reorder(req, res) {
    try {
      const businessId = req.businessId;
      const { order } = req.body;

      if (!Array.isArray(order)) {
        return res.status(400).json({
          success: false,
          message: "order debe ser un array",
        });
      }

      await deliveryMethodPersistenceUseCase.reorder(businessId, order);

      res.json({
        success: true,
        message: "Orden actualizado correctamente",
      });
    } catch (error) {
      console.error("Error reordering delivery methods:", error);
      res.status(500).json({
        success: false,
        message: "Error al reordenar métodos",
      });
    }
  }

  /**
   * POST /api/v2/delivery-methods/initialize
   * Initialize default methods
   */
  async initialize(req, res) {
    try {
      const businessId = req.businessId;

      const methods = await deliveryMethodPersistenceUseCase.initializeDefaults(
        businessId,
        req.user._id,
      );

      res.status(201).json({
        success: true,
        data: { deliveryMethods: methods },
        message: "Métodos por defecto creados correctamente",
      });
    } catch (error) {
      console.error("Error initializing delivery methods:", error);
      res.status(500).json({
        success: false,
        message: "Error al inicializar métodos",
      });
    }
  }
}

export default new DeliveryMethodController();
