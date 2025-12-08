import mongoose from "mongoose";

const profitHistorySchema = new mongoose.Schema(
  {
    // Referencia al usuario (distribuidor o admin)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    // Tipo de transacción
    type: {
      type: String,
      enum: ["venta_normal", "venta_especial", "ajuste", "bonus"],
      required: true,
    },
    
    // Monto de la ganancia
    amount: {
      type: Number,
      required: true,
    },
    
    // Referencia a la venta (si aplica)
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
    },
    
    // Referencia a la venta especial (si aplica)
    specialSale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SpecialSale",
    },
    
    // Producto relacionado
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    
    // Descripción del movimiento
    description: {
      type: String,
      required: true,
    },
    
    // Fecha del movimiento
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    
    // Balance acumulado después de este movimiento
    balanceAfter: {
      type: Number,
      default: 0,
    },
    
    // Metadata adicional
    metadata: {
      quantity: Number,
      salePrice: Number,
      commission: Number,
      eventName: String,
      saleId: String,
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto para consultas eficientes
profitHistorySchema.index({ user: 1, date: -1 });
profitHistorySchema.index({ type: 1, date: -1 });

export default mongoose.model("ProfitHistory", profitHistorySchema);
