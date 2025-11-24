import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // Usuario que realizó la acción
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      enum: ["admin", "distribuidor", "user"],
      required: true,
    },

    // Tipo de acción
    action: {
      type: String,
      enum: [
        // Autenticación
        "login",
        "logout",
        "login_failed",

        // Productos
        "product_created",
        "product_updated",
        "product_deleted",
        "product_price_changed",

        // Categorías
        "category_created",
        "category_updated",
        "category_deleted",

        // Distribuidores
        "distributor_created",
        "distributor_updated",
        "distributor_deleted",
        "distributor_activated",
        "distributor_deactivated",

        // Stock
        "stock_assigned",
        "stock_withdrawn",
        "stock_adjusted",

        // Ventas
        "sale_registered",
        "payment_confirmed",
        "payment_rejected",

        // Productos Defectuosos
        "defective_reported",
        "defective_confirmed",
        "defective_rejected",

        // Otros
        "data_exported",
        "bulk_operation",
      ],
      required: true,
    },

    // Módulo afectado
    module: {
      type: String,
      enum: [
        "auth",
        "products",
        "categories",
        "distributors",
        "stock",
        "sales",
        "defective_products",
        "analytics",
        "system",
      ],
      required: true,
    },

    // Detalles de la acción
    description: {
      type: String,
      required: true,
    },

    // Entidad afectada
    entityType: {
      type: String,
      enum: ["Product", "Category", "User", "Sale", "DistributorStock", "DefectiveProduct", null],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    entityName: {
      type: String,
    },

    // Datos anteriores y nuevos (para cambios)
    oldValues: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Metadata adicional
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },

    // Datos específicos por tipo de acción
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Severidad
    severity: {
      type: String,
      enum: ["info", "warning", "error", "critical"],
      default: "info",
    },
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas eficientes
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
