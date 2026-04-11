import mongoose from "mongoose";

const inventoryEntrySchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
      default: null,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["entry", "adjustment"],
      default: "entry",
    },
    quantity: { type: Number, required: true },
    // Costo unitario de esta entrada específica
    unitCost: { type: Number, default: 0 },
    // Costo total de esta entrada (quantity * unitCost)
    totalCost: { type: Number, default: 0 },
    // Costo promedio del producto después de esta entrada
    averageCostAfter: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    requestId: { type: String, index: true },
    // Agrupación de recepciones - todas las entradas del mismo pedido comparten este ID
    purchaseGroupId: {
      type: String,
      index: true,
    },
    destination: {
      type: String,
      enum: ["branch", "warehouse"],
      default: "warehouse",
    },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

inventoryEntrySchema.index({ business: 1, createdAt: -1 });
inventoryEntrySchema.index({ business: 1, purchaseOrder: 1 });
inventoryEntrySchema.index({ business: 1, branch: 1, createdAt: -1 });
inventoryEntrySchema.index({ business: 1, product: 1, createdAt: -1 });

export default mongoose.model("InventoryEntry", inventoryEntrySchema);
