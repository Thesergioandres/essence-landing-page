/**
 * ProfitHistory Controller - HTTP Layer
 * Handles profit history HTTP requests
 */

import { resolveFinancialPrivacyContext } from "../../../../utils/financialPrivacy.js";
import ProfitHistoryRepository from "../../database/repositories/ProfitHistoryRepository.js";

class ProfitHistoryController {
  /**
   * GET /api/v2/profit-history/user/:userId
   * Get user profit history
   */
  async getUserHistory(req, res) {
    try {
      const { userId } = req.params;
      const businessId = req.businessId;
      const isGodOrSuper =
        req.user?.role === "god" || req.user?.role === "super_admin";

      const history = await ProfitHistoryRepository.getUserHistory(
        userId,
        businessId,
        req.query,
        isGodOrSuper,
      );

      if (!history) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error("Error getting user profit history:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener historial de ganancias",
      });
    }
  }

  /**
   * GET /api/v2/profit-history/balance/:userId
   * Get user balance
   */
  async getUserBalance(req, res) {
    try {
      const { userId } = req.params;
      const businessId = req.businessId;
      const isGodOrSuper =
        req.user?.role === "god" || req.user?.role === "super_admin";

      const balance = await ProfitHistoryRepository.getUserBalance(
        userId,
        businessId,
        isGodOrSuper,
      );

      if (!balance) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: balance,
      });
    } catch (error) {
      console.error("Error getting user balance:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener balance del usuario",
      });
    }
  }

  /**
   * GET /api/v2/profit-history/summary
   * Get profit summary
   */
  async getSummary(req, res) {
    try {
      const businessId = req.businessId;

      const summary = await ProfitHistoryRepository.getSummary(
        businessId,
        req.query,
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("Error getting profit summary:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener resumen de ganancias",
      });
    }
  }

  /**
   * GET /api/v2/profit-history/admin/overview
   * Get admin profit overview
   */
  async getAdminOverview(req, res) {
    try {
      const businessId = req.businessId;
      const { startDate, endDate, limit, distributorId } = req.query;
      const privacy = resolveFinancialPrivacyContext(req);
      const scopedDistributorId = privacy.scopeDistributorId || distributorId;

      const overview = await ProfitHistoryRepository.getAdminOverview(
        businessId,
        {
          startDate,
          endDate,
          limit: parseInt(limit) || 150,
          distributorId: scopedDistributorId,
          hideFinancialData: privacy.hideFinancialData,
        },
      );

      res.json({
        success: true,
        data: overview,
      });
    } catch (error) {
      console.error("Error getting admin profit overview:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener overview de ganancias",
      });
    }
  }

  /**
   * POST /api/v2/profit-history
   * Create profit entry (admin only)
   */
  async create(req, res) {
    try {
      const businessId = req.businessId;
      const { user, type, amount, description } = req.body;

      if (!user || !type || !amount) {
        return res.status(400).json({
          success: false,
          message: "user, type y amount son requeridos",
        });
      }

      const entry = await ProfitHistoryRepository.create({
        business: businessId,
        user,
        type,
        amount,
        description,
        date: new Date(),
        createdBy: req.user._id,
      });

      res.status(201).json({
        success: true,
        data: entry,
        message: "Entrada de ganancia creada correctamente",
      });
    } catch (error) {
      console.error("Error creating profit entry:", error);
      res.status(500).json({
        success: false,
        message: "Error al crear entrada de ganancia",
      });
    }
  }
}

export default new ProfitHistoryController();
