import mongoose from "mongoose";

/**
 * Modelo Credit (Fiado)
 * Registra créditos/fiados otorgados a clientes
 * Estados: pending (pendiente), partial (pago parcial), paid (pagado), overdue (vencido)
 */
const creditSchema = new mongoose.Schema(
  {
    // Referencia al cliente
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "El cliente es obligatorio"],
    },
    // Negocio al que pertenece
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "El negocio es obligatorio"],
    },
    // Venta asociada (opcional - puede ser fiado sin venta registrada)
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
    },
    // Orden de venta asociada (para ventas agrupadas con múltiples productos)
    saleOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleOrder",
    },
    // Sede donde se generó el fiado
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    // Usuario que registró el fiado
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Monto original del fiado
    originalAmount: {
      type: Number,
      required: [true, "El monto es obligatorio"],
      min: [0.01, "El monto debe ser mayor a 0"],
    },
    // Monto pendiente actual
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Monto total pagado
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Estado del crédito
    status: {
      type: String,
      enum: ["pending", "partial", "paid", "overdue", "cancelled"],
      default: "pending",
    },
    // Fecha de vencimiento
    dueDate: {
      type: Date,
    },
    // Descripción/notas del fiado
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // Productos fiados (resumen)
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        productName: String,
        quantity: Number,
        unitPrice: Number,
        subtotal: Number,
        cost: Number,
        image: String,
      },
    ],
    // Fecha del último pago
    lastPaymentAt: {
      type: Date,
    },
    // Fecha en que se marcó como pagado
    paidAt: {
      type: Date,
    },
    // Historial de cambios de estado
    statusHistory: [
      {
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note: String,
      },
    ],
    // Metadatos adicionales
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Índices para búsquedas eficientes
creditSchema.index({ business: 1, status: 1 });
creditSchema.index({ customer: 1, status: 1 });
creditSchema.index({ business: 1, customer: 1 });
creditSchema.index({ dueDate: 1, status: 1 });
creditSchema.index({ branch: 1, status: 1 });

// Pre-save: sincronizar remainingAmount inicial
creditSchema.pre("save", function (next) {
  if (this.isNew) {
    this.remainingAmount = this.originalAmount;
    this.statusHistory = [
      {
        status: "pending",
        changedAt: new Date(),
        changedBy: this.createdBy,
        note: "Fiado creado",
      },
    ];
  }
  next();
});

// Método para verificar si está vencido
creditSchema.methods.checkOverdue = function () {
  if (
    this.dueDate &&
    new Date() > this.dueDate &&
    this.status !== "paid" &&
    this.status !== "cancelled"
  ) {
    return true;
  }
  return false;
};

// Método para calcular días de mora
creditSchema.methods.getDaysOverdue = function () {
  if (!this.dueDate || this.status === "paid" || this.status === "cancelled") {
    return 0;
  }
  const now = new Date();
  const due = new Date(this.dueDate);
  if (now <= due) return 0;
  const diffTime = Math.abs(now - due);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Virtual para nombre del cliente
creditSchema.virtual("customerName", {
  ref: "Customer",
  localField: "customer",
  foreignField: "_id",
  justOne: true,
});

const Credit = mongoose.model("Credit", creditSchema);

export default Credit;
