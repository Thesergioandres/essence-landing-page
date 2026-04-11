import mongoose from "mongoose";

const stockSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockAlert: {
      type: Number,
      default: 10,
    },
  },
  {
    timestamps: true,
  }
);

// Index compuesto para evitar duplicados
stockSchema.index(
  { business: 1, product: 1, distributor: 1 },
  { unique: true }
);

const Stock = mongoose.model("Stock", stockSchema);

export default Stock;
