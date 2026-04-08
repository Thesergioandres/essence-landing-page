import mongoose from "mongoose";

const dispatchItemSchema = new mongoose.Schema(
  {
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
  },
  { _id: false },
);

const dispatchRequestSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [dispatchItemSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "La solicitud debe incluir al menos un producto",
      },
    },
    totalUnits: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["PENDIENTE", "DESPACHADO", "RECIBIDO", "CANCELADO"],
      default: "PENDIENTE",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    shippingGuide: {
      type: String,
      trim: true,
      default: "",
    },
    guideImage: {
      type: String,
      default: "",
    },
    dispatchNotes: {
      type: String,
      trim: true,
      default: "",
    },
    dispatchedAt: {
      type: Date,
      default: null,
    },
    dispatchedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

dispatchRequestSchema.index({ business: 1, status: 1, createdAt: -1 });
dispatchRequestSchema.index({ business: 1, distributor: 1, createdAt: -1 });

export default mongoose.model("DispatchRequest", dispatchRequestSchema);
