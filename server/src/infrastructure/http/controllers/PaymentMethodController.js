/**
 * PaymentMethod Controller - HTTP Layer
 * Handles payment method HTTP requests
 */

import paymentMethodPersistenceUseCase from "../../../application/use-cases/repository-gateways/PaymentMethodPersistenceUseCase.js";

class PaymentMethodController {
  /**
   * GET /api/v2/payment-methods
   * Get all payment methods
   */
  async getAll(req, res) {
    try {
      const businessId = req.businessId;
      const { includeInactive } = req.query;

      const methods = await paymentMethodPersistenceUseCase.findByBusiness(
        businessId,
        includeInactive === "true",
      );

      res.json({
        success: true,
        data: methods,
      });
    } catch (error) {
      console.error("Error getting payment methods:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener métodos de pago",
      });
    }
  }

  /**
   * GET /api/v2/payment-methods/:id
   * Get payment method by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const method = await paymentMethodPersistenceUseCase.findById(id, businessId);

      if (!method) {
        return res.status(404).json({
          success: false,
          message: "Método de pago no encontrado",
        });
      }

      res.json({
        success: true,
        data: method,
      });
    } catch (error) {
      console.error("Error getting payment method:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener método de pago",
      });
    }
  }

  /**
   * POST /api/v2/payment-methods
   * Create new payment method
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

      const method = await paymentMethodPersistenceUseCase.create(
        businessId,
        req.body,
        req.user._id,
      );

      res.status(201).json({
        success: true,
        data: method,
        message: "Método de pago creado correctamente",
      });
    } catch (error) {
      console.error("Error creating payment method:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al crear método de pago",
      });
    }
  }

  /**
   * PUT /api/v2/payment-methods/:id
   * Update payment method
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const method = await paymentMethodPersistenceUseCase.update(
        id,
        businessId,
        req.body,
        req.user._id,
      );

      if (!method) {
        return res.status(404).json({
          success: false,
          message: "Método de pago no encontrado",
        });
      }

      res.json({
        success: true,
        data: method,
        message: "Método de pago actualizado correctamente",
      });
    } catch (error) {
      console.error("Error updating payment method:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al actualizar método de pago",
      });
    }
  }

  /**
   * DELETE /api/v2/payment-methods/:id
   * Delete payment method
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const businessId = req.businessId;

      const deleted = await paymentMethodPersistenceUseCase.delete(id, businessId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Método de pago no encontrado",
        });
      }

      res.json({
        success: true,
        message: "Método de pago eliminado correctamente",
      });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar método de pago",
      });
    }
  }

  /**
   * PUT /api/v2/payment-methods/reorder
   * Reorder payment methods
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

      await paymentMethodPersistenceUseCase.reorder(businessId, order);

      res.json({
        success: true,
        message: "Orden actualizado correctamente",
      });
    } catch (error) {
      console.error("Error reordering payment methods:", error);
      res.status(500).json({
        success: false,
        message: "Error al reordenar métodos",
      });
    }
  }

  /**
   * POST /api/v2/payment-methods/initialize
   * Initialize default methods
   */
  async initialize(req, res) {
    try {
      const businessId = req.businessId;

      const methods = await paymentMethodPersistenceUseCase.initializeDefaults(
        businessId,
        req.user._id,
      );

      res.status(201).json({
        success: true,
        data: methods,
        message: "Métodos por defecto creados correctamente",
      });
    } catch (error) {
      console.error("Error initializing payment methods:", error);
      res.status(500).json({
        success: false,
        message: "Error al inicializar métodos",
      });
    }
  }
}

export default new PaymentMethodController();
