/**
 * CustomerPoints Controller - HTTP Layer
 * Handles customer points HTTP requests
 */

import customerPointsPersistenceUseCase from "../../../application/use-cases/repository-gateways/CustomerPointsPersistenceUseCase.js";

// Default points configuration
const DEFAULT_POINTS_CONFIG = {
  pointValue: 100, // 1 point = $100 COP
  earnRate: 0.01, // 1% of purchase = points
  minRedemption: 10, // Minimum 10 points to redeem
};

class CustomerPointsController {
  /**
   * GET /api/v2/customers/:customerId/points
   * Get customer points balance
   */
  async getBalance(req, res) {
    try {
      const { customerId } = req.params;
      const businessId = req.businessId;

      const balance = await customerPointsPersistenceUseCase.getBalance(
        customerId,
        businessId,
      );

      if (!balance) {
        return res.status(404).json({
          success: false,
          message: "Cliente no encontrado",
        });
      }

      // Calculate monetary value
      const monetaryValue =
        balance.currentPoints * DEFAULT_POINTS_CONFIG.pointValue;

      res.json({
        success: true,
        data: {
          ...balance,
          pointValue: DEFAULT_POINTS_CONFIG.pointValue,
          monetaryValue,
        },
      });
    } catch (error) {
      console.error("Error getting customer points:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener puntos del cliente",
      });
    }
  }

  /**
   * GET /api/v2/customers/:customerId/points/history
   * Get customer points history
   */
  async getHistory(req, res) {
    try {
      const { customerId } = req.params;
      const businessId = req.businessId;
      const { limit = 50, skip = 0 } = req.query;

      const history = await customerPointsPersistenceUseCase.getHistory(
        customerId,
        businessId,
        {
          limit: parseInt(limit, 10),
          skip: parseInt(skip, 10),
        },
      );

      if (!history) {
        return res.status(404).json({
          success: false,
          message: "Cliente no encontrado",
        });
      }

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error("Error getting points history:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener historial de puntos",
      });
    }
  }

  /**
   * POST /api/v2/customers/:customerId/points/adjust
   * Adjust customer points (admin only)
   */
  async adjustPoints(req, res) {
    try {
      const { customerId } = req.params;
      const businessId = req.businessId;
      const { amount, description } = req.body;

      if (!amount || !description) {
        return res.status(400).json({
          success: false,
          message: "amount y description son requeridos",
        });
      }

      if (typeof amount !== "number") {
        return res.status(400).json({
          success: false,
          message: "amount debe ser un número",
        });
      }

      const result = await customerPointsPersistenceUseCase.adjustPoints(
        customerId,
        businessId,
        amount,
        description,
        req.user._id,
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Cliente no encontrado",
        });
      }

      res.json({
        success: true,
        data: result,
        message: `Puntos ${amount > 0 ? "agregados" : "deducidos"} correctamente`,
      });
    } catch (error) {
      console.error("Error adjusting points:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al ajustar puntos",
      });
    }
  }

  /**
   * POST /api/v2/customers/:customerId/points/validate-redemption
   * Validate if customer can redeem points
   */
  async validateRedemption(req, res) {
    try {
      const { customerId } = req.params;
      const businessId = req.businessId;
      const { pointsToRedeem } = req.body;

      if (!pointsToRedeem || typeof pointsToRedeem !== "number") {
        return res.status(400).json({
          success: false,
          message: "pointsToRedeem es requerido y debe ser un número",
        });
      }

      if (pointsToRedeem < DEFAULT_POINTS_CONFIG.minRedemption) {
        return res.status(400).json({
          success: false,
          message: `Mínimo ${DEFAULT_POINTS_CONFIG.minRedemption} puntos para redimir`,
        });
      }

      const validation = await customerPointsPersistenceUseCase.validateRedemption(
        customerId,
        businessId,
        pointsToRedeem,
      );

      res.json({
        success: validation.valid,
        data: validation,
        message: validation.message || "Validación exitosa",
      });
    } catch (error) {
      console.error("Error validating redemption:", error);
      res.status(500).json({
        success: false,
        message: "Error al validar redención",
      });
    }
  }

  /**
   * POST /api/v2/points/expire
   * Expire old points (admin/cron only)
   */
  async expirePoints(req, res) {
    try {
      const businessId = req.businessId;
      const { daysOld = 365 } = req.body;

      const result = await customerPointsPersistenceUseCase.expirePoints(
        businessId,
        daysOld,
      );

      res.json({
        success: true,
        data: result,
        message: "Puntos expirados correctamente",
      });
    } catch (error) {
      console.error("Error expiring points:", error);
      res.status(500).json({
        success: false,
        message: "Error al expirar puntos",
      });
    }
  }

  /**
   * GET /api/v2/points/config
   * Get points configuration
   */
  async getConfig(req, res) {
    res.json({
      success: true,
      data: DEFAULT_POINTS_CONFIG,
    });
  }
}

export default new CustomerPointsController();
