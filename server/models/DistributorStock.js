import mongoose from "mongoose";

const distributorStockSchema = new mongoose.Schema(
  {
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, "La cantidad no puede ser negativa"],
      default: 0,
    },
    lowStockAlert: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto para evitar duplicados
distributorStockSchema.index({ distributor: 1, product: 1 }, { unique: true });

export default mongoose.model("DistributorStock", distributorStockSchema);
