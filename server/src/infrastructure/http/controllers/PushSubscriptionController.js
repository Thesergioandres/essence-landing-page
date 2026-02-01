/**
 * PushSubscription Controller - HTTP Layer
 * Handles push subscription HTTP requests
 */

import PushSubscriptionRepository from "../../database/repositories/PushSubscriptionRepository.js";

class PushSubscriptionController {
  /**
   * POST /api/v2/push/subscribe
   * Register push subscription
   */
  async subscribe(req, res) {
    try {
      const { subscription, userAgent } = req.body;
      const userId = req.user._id;
      const businessId = req.businessId;

      const pushSub = await PushSubscriptionRepository.subscribe(
        userId,
        businessId,
        subscription,
        userAgent,
      );

      res.status(201).json({
        success: true,
        data: { id: pushSub._id },
        message: "Suscripción registrada correctamente",
      });
    } catch (error) {
      console.error("Error subscribing push:", error);

      // Handle duplicate key error
      if (error.code === 11000) {
        return res.status(200).json({
          success: true,
          message: "Suscripción ya existe",
        });
      }

      res.status(500).json({
        success: false,
        message: error.message || "Error al registrar suscripción",
      });
    }
  }

  /**
   * POST /api/v2/push/unsubscribe
   * Unsubscribe push notification
   */
  async unsubscribe(req, res) {
    try {
      const { endpoint } = req.body;
      const userId = req.user._id;

      const result = await PushSubscriptionRepository.unsubscribe(
        userId,
        endpoint,
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Suscripción no encontrada",
        });
      }

      res.json({
        success: true,
        message: "Suscripción desactivada correctamente",
      });
    } catch (error) {
      console.error("Error unsubscribing push:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al desactivar suscripción",
      });
    }
  }

  /**
   * GET /api/v2/push/subscriptions
   * Get user subscriptions
   */
  async getSubscriptions(req, res) {
    try {
      const userId = req.user._id;
      const businessId = req.businessId;

      const subscriptions =
        await PushSubscriptionRepository.getUserSubscriptions(
          userId,
          businessId,
        );

      res.json({
        success: true,
        data: { subscriptions },
      });
    } catch (error) {
      console.error("Error getting subscriptions:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener suscripciones",
      });
    }
  }

  /**
   * PUT /api/v2/push/subscriptions/:id/preferences
   * Update subscription preferences
   */
  async updatePreferences(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;
      const preferences = req.body;

      const subscription = await PushSubscriptionRepository.updatePreferences(
        userId,
        id,
        preferences,
      );

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Suscripción no encontrada",
        });
      }

      res.json({
        success: true,
        data: { subscription },
        message: "Preferencias actualizadas correctamente",
      });
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({
        success: false,
        message: "Error al actualizar preferencias",
      });
    }
  }

  /**
   * DELETE /api/v2/push/subscriptions/:id
   * Delete subscription
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      const deleted = await PushSubscriptionRepository.delete(userId, id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Suscripción no encontrada",
        });
      }

      res.json({
        success: true,
        message: "Suscripción eliminada correctamente",
      });
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({
        success: false,
        message: "Error al eliminar suscripción",
      });
    }
  }

  /**
   * GET /api/v2/push/vapid-key
   * Get VAPID public key
   */
  async getVapidKey(req, res) {
    try {
      const publicKey = PushSubscriptionRepository.getVapidPublicKey();

      if (!publicKey) {
        return res.status(500).json({
          success: false,
          message: "VAPID key not configured",
        });
      }

      res.json({
        success: true,
        data: { publicKey },
      });
    } catch (error) {
      console.error("Error getting VAPID key:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener clave VAPID",
      });
    }
  }
}

export default new PushSubscriptionController();
