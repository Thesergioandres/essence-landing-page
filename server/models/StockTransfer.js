import mongoose from "mongoose";

const stockTransferSchema = new mongoose.Schema(
  {
    fromDistributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toDistributor: {
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
      min: 1,
    },
    fromStockBefore: {
      type: Number,
      required: true,
    },
    fromStockAfter: {
      type: Number,
      required: true,
    },
    toStockBefore: {
      type: Number,
      default: 0,
    },
    toStockAfter: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "failed", "cancelled"],
      default: "completed",
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas rápidas
stockTransferSchema.index({ fromDistributor: 1, createdAt: -1 });
stockTransferSchema.index({ toDistributor: 1, createdAt: -1 });
stockTransferSchema.index({ product: 1, createdAt: -1 });
stockTransferSchema.index({ createdAt: -1 });

const StockTransfer = mongoose.model("StockTransfer", stockTransferSchema);

export default StockTransfer;
