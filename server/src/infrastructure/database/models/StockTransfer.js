import mongoose from "mongoose";

const stockTransferSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    fromEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    toBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: false,
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
  },
);

// Índices para búsquedas rápidas
stockTransferSchema.index({ fromEmployee: 1, createdAt: -1 });
stockTransferSchema.index({ toEmployee: 1, createdAt: -1 });
stockTransferSchema.index({ toBranch: 1, createdAt: -1 });
stockTransferSchema.index({ product: 1, createdAt: -1 });
stockTransferSchema.index({ createdAt: -1 });

const StockTransfer = mongoose.model("StockTransfer", stockTransferSchema);

export default StockTransfer;
