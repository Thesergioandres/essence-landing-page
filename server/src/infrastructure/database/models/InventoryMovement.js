import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["warehouse", "branch", "distributor", "transit"],
      required: true,
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const inventoryMovementSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    movementType: {
      type: String,
      enum: [
        "DISPATCH_OUTBOUND",
        "DISPATCH_IN_TRANSIT",
        "DISPATCH_RECEIVED",
        "SALE_PROMOTION_OUTBOUND",
        "INBOUND_RETURN",
      ],
      required: true,
      index: true,
    },
    fromLocation: {
      type: locationSchema,
      required: true,
    },
    toLocation: {
      type: locationSchema,
      required: true,
    },
    referenceModel: {
      type: String,
      enum: ["DispatchRequest", "Sale", "User"],
      default: "DispatchRequest",
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

inventoryMovementSchema.index({
  business: 1,
  movementType: 1,
  createdAt: -1,
});
inventoryMovementSchema.index({
  business: 1,
  referenceId: 1,
  createdAt: -1,
});

export default mongoose.models.InventoryMovement ||
  mongoose.model("InventoryMovement", inventoryMovementSchema);
