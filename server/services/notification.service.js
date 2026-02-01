import Notification from "../models/Notification.js";
import { logApiError, logApiInfo } from "../utils/logger.js";

/**
 * Servicio centralizado para crear notificaciones automáticas
 * basadas en eventos del sistema
 */
const NotificationService = {
  /**
   * Notificar nueva venta registrada
   */
  async notifySaleCreated({
    businessId,
    saleId,
    productName,
    quantity,
    salePrice,
    distributorName,
    requestId,
  }) {
    try {
      const total = (salePrice || 0) * (quantity || 1);
      await Notification.createWithLog(
        {
          business: businessId,
          targetRole: "admin",
          type: "sale",
          title: "Nueva venta registrada",
          message: `${
            distributorName || "Distribuidor"
          } vendió ${quantity}x ${productName} por $${total.toFixed(0)}`,
          priority: "low",
          link: `/sales`,
          relatedEntity: { type: "Sale", id: saleId },
        },
        requestId,
      );
      logApiInfo({
        message: "notification_sale_created",
        module: "notification",
        requestId,
        businessId: businessId?.toString(),
      });
    } catch (error) {
      logApiError({
        message: "Error creando notificación de venta",
        module: "notification",
        requestId,
        stack: error.stack,
      });
    }
  },

  /**
   * Notificar stock bajo de un producto
   */
  async notifyLowStock({
    businessId,
    productId,
    productName,
    currentStock,
    threshold = 10,
    requestId,
  }) {
    try {
      // Evitar crear notificaciones duplicadas (verificar si ya existe una reciente)
      const recentNotification = await Notification.findOne({
        business: businessId,
        type: "low_stock",
        "relatedEntity.id": productId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // últimas 24h
      });

      if (recentNotification) {
        return; // Ya existe una notificación reciente
      }

      await Notification.createWithLog(
        {
          business: businessId,
          targetRole: "admin",
          type: "low_stock",
          title: "Stock bajo",
          message: `El producto "${productName}" tiene solo ${currentStock} unidades (umbral: ${threshold})`,
          priority: "high",
          link: `/products/${productId}`,
          relatedEntity: { type: "Product", id: productId },
        },
        requestId,
      );
      logApiInfo({
        message: "notification_low_stock",
        module: "notification",
        requestId,
        businessId: businessId?.toString(),
        extra: { productId: productId?.toString(), currentStock },
      });
    } catch (error) {
      logApiError({
        message: "Error creando notificación de stock bajo",
        module: "notification",
        requestId,
        stack: error.stack,
      });
    }
  },

  /**
   * Notificar crédito/fiado vencido
   */
  async notifyCreditOverdue({
    businessId,
    creditId,
    customerName,
    amount,
    daysOverdue,
    requestId,
  }) {
    try {
      await Notification.createWithLog(
        {
          business: businessId,
          targetRole: "admin",
          type: "credit_overdue",
          title: "Crédito vencido",
          message: `El fiado de ${customerName} por $${amount.toFixed(
            0,
          )} está vencido hace ${daysOverdue} días`,
          priority: "high",
          link: `/credits/${creditId}`,
          relatedEntity: { type: "Credit", id: creditId },
        },
        requestId,
      );
      logApiInfo({
        message: "notification_credit_overdue",
        module: "notification",
        requestId,
        businessId: businessId?.toString(),
        extra: { creditId: creditId?.toString(), daysOverdue },
      });
    } catch (error) {
      logApiError({
        message: "Error creando notificación de crédito vencido",
        module: "notification",
        requestId,
        stack: error.stack,
      });
    }
  },

  /**
   * Notificar pago de crédito recibido
   */
  async notifyPaymentReceived({
    businessId,
    creditId,
    customerName,
    paymentAmount,
    remainingAmount,
    requestId,
  }) {
    try {
      const isPaidOff = remainingAmount <= 0;
      await Notification.createWithLog(
        {
          business: businessId,
          targetRole: "admin",
          type: "payment",
          title: isPaidOff
            ? "Fiado pagado completamente"
            : "Pago de fiado recibido",
          message: isPaidOff
            ? `${customerName} pagó completamente su deuda de $${paymentAmount.toFixed(
                0,
              )}`
            : `${customerName} abonó $${paymentAmount.toFixed(
                0,
              )}. Resta: $${remainingAmount.toFixed(0)}`,
          priority: isPaidOff ? "medium" : "low",
          link: `/credits/${creditId}`,
          relatedEntity: { type: "Credit", id: creditId },
        },
        requestId,
      );
      logApiInfo({
        message: "notification_payment_received",
        module: "notification",
        requestId,
        businessId: businessId?.toString(),
        extra: {
          creditId: creditId?.toString(),
          paymentAmount,
          remainingAmount,
        },
      });
    } catch (error) {
      logApiError({
        message: "Error creando notificación de pago",
        module: "notification",
        requestId,
        stack: error.stack,
      });
    }
  },

  /**
   * Notificar nuevo cliente registrado
   */
  async notifyNewCustomer({ businessId, customerId, customerName, requestId }) {
    try {
      await Notification.createWithLog(
        {
          business: businessId,
          targetRole: "admin",
          type: "system",
          title: "Nuevo cliente",
          message: `Se registró el cliente "${customerName}"`,
          priority: "low",
          link: `/customers/${customerId}`,
          relatedEntity: { type: "Customer", id: customerId },
        },
        requestId,
      );
    } catch (error) {
      logApiError({
        message: "Error creando notificación de nuevo cliente",
        module: "notification",
        requestId,
        stack: error.stack,
      });
    }
  },

  /**
   * Notificar logro de gamificación
   */
  async notifyAchievement({
    businessId,
    userId,
    userName,
    achievementName,
    requestId,
  }) {
    try {
      await Notification.createWithLog(
        {
          business: businessId,
          targetUser: userId,
          type: "system",
          title: "¡Logro desbloqueado!",
          message: `Felicitaciones ${userName}, has conseguido: "${achievementName}"`,
          priority: "medium",
          link: `/gamification`,
          relatedEntity: { type: "User", id: userId },
        },
        requestId,
      );
    } catch (error) {
      logApiError({
        message: "Error creando notificación de logro",
        module: "notification",
        requestId,
        stack: error.stack,
      });
    }
  },

  /**
   * Verificar y notificar créditos vencidos (para cron job)
   */
  async checkOverdueCredits(businessId, requestId) {
    try {
      const Credit = (await import("../models/Credit.js")).default;
      const Customer = (await import("../models/Customer.js")).default;

      const now = new Date();
      const overdueCredits = await Credit.find({
        business: businessId,
        status: { $in: ["pending", "partial"] },
        dueDate: { $lt: now },
      }).populate("customer", "name");

      for (const credit of overdueCredits) {
        const daysOverdue = Math.floor(
          (now - credit.dueDate) / (1000 * 60 * 60 * 24),
        );

        // Actualizar estado a overdue si no lo está
        if (credit.status !== "overdue") {
          credit.status = "overdue";
          credit.statusHistory.push({
            status: "overdue",
            changedAt: now,
            note: "Marcado como vencido automáticamente",
          });
          await credit.save();
        }

        // Notificar solo si han pasado más de 1 día
        if (daysOverdue >= 1) {
          await this.notifyCreditOverdue({
            businessId,
            creditId: credit._id,
            customerName: credit.customer?.name || "Cliente desconocido",
            amount: credit.remainingAmount,
            daysOverdue,
            requestId,
          });
        }
      }

      return overdueCredits.length;
    } catch (error) {
      logApiError({
        message: "Error verificando créditos vencidos",
        module: "notification",
        requestId,
        stack: error.stack,
      });
      return 0;
    }
  },

  /**
   * Verificar y notificar productos con stock bajo (para cron job)
   */
  async checkLowStock(businessId, threshold = 10, requestId) {
    try {
      const Product = (
        await import("../src/infrastructure/database/models/Product.js")
      ).default;

      const lowStockProducts = await Product.find({
        business: businessId,
        totalStock: { $lte: threshold, $gt: 0 },
        isActive: true,
      });

      for (const product of lowStockProducts) {
        await this.notifyLowStock({
          businessId,
          productId: product._id,
          productName: product.name,
          currentStock: product.totalStock,
          threshold,
          requestId,
        });
      }

      return lowStockProducts.length;
    } catch (error) {
      logApiError({
        message: "Error verificando stock bajo",
        module: "notification",
        requestId,
        stack: error.stack,
      });
      return 0;
    }
  },
};

export default NotificationService;
