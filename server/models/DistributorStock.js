import mongoose from "mongoose";

const distributorStockSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
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
    inTransitQuantity: {
      type: Number,
      required: true,
      min: [0, "La cantidad en tránsito no puede ser negativa"],
      default: 0,
    },
    lowStockAlert: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  },
);

// Índice compuesto para evitar duplicados
distributorStockSchema.index(
  { business: 1, distributor: 1, product: 1 },
  { unique: true },
);
// Índice adicional para queries por distribuidor
distributorStockSchema.index({ business: 1, distributor: 1, quantity: 1 });
distributorStockSchema.index({
  business: 1,
  distributor: 1,
  inTransitQuantity: 1,
});

export default mongoose.model("DistributorStock", distributorStockSchema);
