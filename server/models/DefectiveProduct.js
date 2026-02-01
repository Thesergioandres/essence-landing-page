import mongoose from "mongoose";

const defectiveProductSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Opcional: puede ser null si el admin reporta desde bodega
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "El producto es obligatorio"],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    quantity: {
      type: Number,
      required: [true, "La cantidad es obligatoria"],
      min: [1, "La cantidad debe ser al menos 1"],
    },
    reason: {
      type: String,
      required: [true, "Debe especificar la razón del defecto"],
      trim: true,
    },
    images: [
      {
        url: String,
        publicId: String,
      },
    ],
    // Campo de garantía: si tiene garantía, se repone stock; si no, es pérdida
    hasWarranty: {
      type: Boolean,
      default: false,
    },
    // Estado de la garantía
    warrantyStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "not_applicable"],
      default: "not_applicable",
    },
    // Costo de pérdida (si no hay garantía)
    lossAmount: {
      type: Number,
      default: 0,
    },
    // Stock repuesto (si hay garantía aprobada)
    stockRestored: {
      type: Boolean,
      default: false,
    },
    stockRestoredAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["pendiente", "confirmado", "rechazado"],
      default: "pendiente",
    },
    reportDate: {
      type: Date,
      default: Date.now,
    },
    confirmedAt: {
      type: Date,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    // Origen del stock para restauración en caso de borrado
    stockOrigin: {
      type: String,
      enum: ["warehouse", "branch", "distributor"],
      default: "warehouse",
    },
    // ⭐ Asociación con pedido de venta (para garantías agregadas desde registro de pedido)
    saleGroupId: {
      type: String,
      trim: true,
      index: true,
    },
    // Origen del reporte
    origin: {
      type: String,
      enum: ["direct", "order"], // direct = reporte manual, order = desde registro de pedido
      default: "direct",
    },
  },
  {
    timestamps: true,
  },
);

// Índices para búsquedas frecuentes
defectiveProductSchema.index({ business: 1, status: 1 });
defectiveProductSchema.index({ distributor: 1, status: 1 });
defectiveProductSchema.index({ product: 1, reportDate: -1 });

export default mongoose.models.DefectiveProduct ||
  mongoose.model("DefectiveProduct", defectiveProductSchema);
