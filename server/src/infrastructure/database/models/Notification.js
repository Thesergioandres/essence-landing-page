import mongoose from "mongoose";

/**
 * Modelo Notification
 * Sistema de notificaciones internas de la aplicaciÃ³n
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
    // Rol destinatario (si aplica a un rol especÃ­fico)
    targetRole: {
      type: String,
      enum: ["admin", "employee", "all"],
    },
    // Tipo de notificaciÃ³n
    type: {
      type: String,
      enum: [
        "sale", // Nueva venta
        "low_stock", // Stock bajo
        "stock_entry", // Entrada de mercancÃ­a
        "promotion", // PromociÃ³n activa
        "credit_overdue", // Fiado vencido
        "credit_payment", // Pago de fiado recibido
        "subscription", // Cambio de suscripciÃ³n
        "incident", // Nueva incidencia
        "achievement", // Logro desbloqueado
        "ranking", // Cambio en ranking
        "system", // Sistema general
        "reminder", // Recordatorio
      ],
      required: true,
    },
    // TÃ­tulo de la notificaciÃ³n
    title: {
      type: String,
      required: [true, "El tÃ­tulo es obligatorio"],
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
    // Enlace relacionado (navegaciÃ³n interna)
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
    // Datos adicionales para la notificaciÃ³n
    data: {
      type: mongoose.Schema.Types.Mixed,
    },
    // ExpiraciÃ³n de la notificaciÃ³n
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

// Ãndices para consultas eficientes
notificationSchema.index({ business: 1, user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ business: 1, targetRole: 1, read: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ type: 1, business: 1 });

// MÃ©todo estÃ¡tico para crear notificaciÃ³n con log
notificationSchema.statics.createWithLog = async function (data, requestId) {
  const notification = await this.create(data);
  console.warn("[Essence Debug]", "[API INFO] notification_created", {
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

