import mongoose from "mongoose";

/**
 * Modelo Notification
 * Sistema de notificaciones internas de la aplicación
 */
const notificationSchema = new mongoose.Schema(
  {
    // Negocio al que pertenece
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "El negocio es obligatorio"],
    },
    // Usuario destinatario (null = todos los del negocio)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Rol destinatario (si aplica a un rol específico)
    targetRole: {
      type: String,
      enum: ["admin", "distribuidor", "all"],
    },
    // Tipo de notificación
    type: {
      type: String,
      enum: [
        "sale", // Nueva venta
        "low_stock", // Stock bajo
        "stock_entry", // Entrada de mercancía
        "promotion", // Promoción activa
        "credit_overdue", // Fiado vencido
        "credit_payment", // Pago de fiado recibido
        "subscription", // Cambio de suscripción
        "incident", // Nueva incidencia
        "achievement", // Logro desbloqueado
        "ranking", // Cambio en ranking
        "system", // Sistema general
        "reminder", // Recordatorio
      ],
      required: true,
    },
    // Título de la notificación
    title: {
      type: String,
      required: [true, "El título es obligatorio"],
      trim: true,
      maxlength: 100,
    },
    // Mensaje/contenido
    message: {
      type: String,
      required: [true, "El mensaje es obligatorio"],
      trim: true,
      maxlength: 500,
    },
    // Prioridad
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    // Estado de lectura
    read: {
      type: Boolean,
      default: false,
    },
    // Fecha de lectura
    readAt: {
      type: Date,
    },
    // Enlace relacionado (navegación interna)
    link: {
      type: String,
      trim: true,
    },
    // Referencia a entidad relacionada
    relatedEntity: {
      type: {
        type: String,
        enum: [
          "Sale",
          "Product",
          "Credit",
          "Customer",
          "User",
          "Promotion",
          "Issue",
        ],
      },
      id: mongoose.Schema.Types.ObjectId,
    },
    // Datos adicionales para la notificación
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Expiración de la notificación
    expiresAt: {
      type: Date,
    },
    // Si fue enviada por push notification
    pushSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para consultas eficientes
notificationSchema.index({ business: 1, user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ business: 1, targetRole: 1, read: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ type: 1, business: 1 });

// Método estático para crear notificación con log
notificationSchema.statics.createWithLog = async function (data, requestId) {
  const notification = await this.create(data);
  console.log("[API INFO] notification_created", {
    module: "notification",
    requestId,
    businessId: data.business?.toString(),
    type: data.type,
    userId: data.user?.toString(),
  });
  return notification;
};

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
