import Notification from "../models/Notification.js";

export class NotificationRepository {
  async findByUser(businessId, userId, userRole, filters = {}) {
    const filter = {
      business: businessId,
      $or: [
        { user: userId },
        { user: null, targetRole: "all" },
        {
          user: null,
          targetRole:
            userRole === "admin" || userRole === "super_admin"
              ? "admin"
              : userRole,
        },
      ],
    };

    if (filters.read !== undefined) {
      filter.read = filters.read === "true";
    }

    if (filters.type) {
      filter.type = filters.type;
    }

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async create(data) {
    const notification = await Notification.create(data);
    return notification;
  }

  async markAsRead(id, businessId, userId) {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        business: businessId,
        $or: [{ user: userId }, { user: null }],
      },
      { read: true, readAt: Date.now() },
      { new: true },
    );

    if (!notification) {
      const err = new Error("Notificación no encontrada");
      err.statusCode = 404;
      throw err;
    }

    return notification;
  }

  async markAllAsRead(businessId, userId, userRole) {
    const filter = {
      business: businessId,
      read: false,
      $or: [
        { user: userId },
        { user: null, targetRole: "all" },
        {
          user: null,
          targetRole:
            userRole === "admin" || userRole === "super_admin"
              ? "admin"
              : userRole,
        },
      ],
    };

    const result = await Notification.updateMany(filter, {
      read: true,
      readAt: Date.now(),
    });

    return { modifiedCount: result.modifiedCount };
  }

  async delete(id, businessId) {
    const notification = await Notification.findOneAndDelete({
      _id: id,
      business: businessId,
    });

    if (!notification) {
      const err = new Error("Notificación no encontrada");
      err.statusCode = 404;
      throw err;
    }

    return notification;
  }
}
