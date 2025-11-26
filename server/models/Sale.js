import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "El distribuidor es obligatorio"],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "El producto es obligatorio"],
    },
    quantity: {
      type: Number,
      required: [true, "La cantidad es obligatoria"],
      min: [1, "La cantidad debe ser al menos 1"],
    },
    // Precios al momento de la venta
    purchasePrice: {
      type: Number,
      required: true,
    },
    distributorPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    // Ganancias calculadas
    distributorProfit: {
      type: Number,
      default: 0,
    },
    adminProfit: {
      type: Number,
      default: 0,
    },
    totalProfit: {
      type: Number,
      default: 0,
    },
    // Información adicional
    notes: {
      type: String,
      trim: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
    },
    // Estado de pago
    paymentStatus: {
      type: String,
      enum: ["pendiente", "confirmado"],
      default: "pendiente",
    },
    paymentConfirmedAt: {
      type: Date,
    },
    paymentConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Comprobante de transferencia
    paymentProof: {
      type: String, // Base64 de la imagen
      default: null,
    },
    paymentProofMimeType: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Calcular ganancias antes de guardar
saleSchema.pre("save", function (next) {
  // Ganancia del distribuidor: (precio de venta - precio distribuidor) * cantidad
  this.distributorProfit = (this.salePrice - this.distributorPrice) * this.quantity;
  
  // Ganancia del admin: (precio distribuidor - precio de compra) * cantidad
  this.adminProfit = (this.distributorPrice - this.purchasePrice) * this.quantity;
  
  // Ganancia total
  this.totalProfit = this.distributorProfit + this.adminProfit;
  
  next();
});

export default mongoose.model("Sale", saleSchema);
