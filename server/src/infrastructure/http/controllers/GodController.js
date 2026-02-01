/**
 * God Controller V2 - HTTP Layer
 * Handles super admin operations
 */

import { logApiError, logApiInfo } from "../../../../utils/logger.js";
import GodRepository from "../../database/repositories/GodRepository.js";

class GodController {
  /**
   * GET /api/v2/god/metrics
   * Get global system metrics
   */
  async getMetrics(req, res) {
    try {
      const metrics = await GodRepository.getGlobalMetrics();

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error("Error getting global metrics:", error);
      res.status(500).json({
        success: false,
        message: "Error obteniendo métricas globales",
      });
    }
  }

  /**
   * GET /api/v2/god/subscriptions
   * Get subscriptions summary
   */
  async getSubscriptions(req, res) {
    try {
      const subscriptions = await GodRepository.getSubscriptionsSummary();

      res.json({
        success: true,
        data: { subscriptions },
      });
    } catch (error) {
      console.error("Error getting subscriptions summary:", error);
      res.status(500).json({
        success: false,
        message: "Error obteniendo resumen de suscripciones",
      });
    }
  }

  /**
   * GET /api/v2/god/users
   * List all users
   */
  async listUsers(req, res) {
    try {
      const users = await GodRepository.listUsers();

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({
        success: false,
        message: "Error listando usuarios",
      });
    }
  }

  /**
   * GET /api/v2/god/users/email/:email
   * Find user by email
   */
  async findUserByEmail(req, res) {
    try {
      const { email } = req.params;
      const user = await GodRepository.findUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error("Error finding user:", error);
      res.status(500).json({
        success: false,
        message: "Error buscando usuario",
      });
    }
  }

  /**
   * POST /api/v2/god/users/:id/activate
   * Activate user
   */
  async activateUser(req, res) {
    try {
      const { id } = req.params;
      const { days = 30, months = 0, years = 0 } = req.body || {};

      const user = await GodRepository.activateUser(id, {
        days,
        months,
        years,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: { user },
        message: "Usuario activado correctamente",
      });
    } catch (error) {
      console.error("Error activating user:", error);
      res.status(500).json({
        success: false,
        message: "Error activando usuario",
      });
    }
  }

  /**
   * POST /api/v2/god/users/:id/suspend
   * Suspend user
   */
  async suspendUser(req, res) {
    try {
      const { id } = req.params;

      const user = await GodRepository.suspendUser(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: { user },
        message: "Usuario suspendido correctamente",
      });
    } catch (error) {
      console.error("Error suspending user:", error);
      res.status(500).json({
        success: false,
        message: "Error suspendiendo usuario",
      });
    }
  }

  /**
   * DELETE /api/v2/god/users/:id
   * Delete user and all associated data
   */
  async deleteUser(req, res) {
    const requestId = req.reqId || `delete-user-${Date.now()}`;

    try {
      const { id } = req.params;

      const result = await GodRepository.deleteUser(id, req.user.id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
          requestId,
        });
      }

      logApiInfo({
        message: "god_delete_user_success",
        module: "god",
        requestId,
        extra: {
          deletedUserId: id,
          deletedBusinesses: result.deletedBusinesses,
        },
      });

      res.json({
        success: true,
        data: { deletedBusinesses: result.deletedBusinesses },
        message: "Usuario eliminado correctamente",
        requestId,
      });
    } catch (error) {
      logApiError({
        message: "god_delete_user_error",
        module: "god",
        requestId,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        message: error.message || "Error eliminando usuario",
        requestId,
      });
    }
  }

  /**
   * POST /api/v2/god/users/:id/extend
   * Extend subscription
   */
  async extendSubscription(req, res) {
    try {
      const { id } = req.params;
      const { days = 0, months = 0, years = 0 } = req.body || {};

      const user = await GodRepository.extendSubscription(id, {
        days,
        months,
        years,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: { user },
        message: "Suscripción extendida correctamente",
      });
    } catch (error) {
      console.error("Error extending subscription:", error);
      res.status(500).json({
        success: false,
        message: "Error extendiendo suscripción",
      });
    }
  }

  /**
   * POST /api/v2/god/users/:id/pause
   * Pause subscription
   */
  async pauseSubscription(req, res) {
    try {
      const { id } = req.params;

      const user = await GodRepository.pauseSubscription(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: { user },
        message: "Suscripción pausada correctamente",
      });
    } catch (error) {
      console.error("Error pausing subscription:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error pausando suscripción",
      });
    }
  }

  /**
   * POST /api/v2/god/users/:id/resume
   * Resume subscription
   */
  async resumeSubscription(req, res) {
    try {
      const { id } = req.params;

      const user = await GodRepository.resumeSubscription(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado",
        });
      }

      res.json({
        success: true,
        data: { user },
        message: "Suscripción reanudada correctamente",
      });
    } catch (error) {
      console.error("Error resuming subscription:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error reanudando suscripción",
      });
    }
  }
}

export default new GodController();
