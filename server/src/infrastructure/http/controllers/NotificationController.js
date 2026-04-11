import { NotificationPersistenceUseCase } from "../../../application/use-cases/repository-gateways/NotificationPersistenceUseCase.js";

const repository = new NotificationPersistenceUseCase();

export class NotificationController {
  async getAll(req, res) {
    try {
      const businessId = req.businessId;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const result = await repository.findByUser(
        businessId,
        userId,
        userRole,
        req.query,
      );
      res.json({
        success: true,
        data: result.notifications,
        unreadCount: result.unreadCount,
        pagination: result.pagination,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async create(req, res) {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return res
          .status(400)
          .json({ success: false, message: "Falta x-business-id" });
      }

      const notification = await repository.create({
        ...req.body,
        business: businessId,
      });
      res.status(201).json({ success: true, data: notification });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async markAsRead(req, res) {
    try {
      const businessId = req.businessId;
      const userId = req.user?.id;

      const notification = await repository.markAsRead(
        req.params.id,
        businessId,
        userId,
      );
      res.json({ success: true, data: notification });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const businessId = req.businessId;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await repository.markAllAsRead(
        businessId,
        userId,
        userRole,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const businessId = req.businessId;
      await repository.delete(req.params.id, businessId);
      res.json({ success: true, message: "Notificación eliminada" });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message });
    }
  }
}
