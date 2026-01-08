import mongoose from "mongoose";

const pointsHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["earned", "redeemed", "bonus", "adjustment", "expired"],
      required: true,
    },
    amount: { type: Number, required: true }, // Positivo o negativo
    balance: { type: Number, required: true }, // Balance después de operación
    description: { type: String },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "referenceModel",
    },
    referenceModel: { type: String, enum: ["Sale", "User", null] },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    segment: { type: mongoose.Schema.Types.ObjectId, ref: "Segment" },
    segments: [{ type: String, trim: true }],
    // Sistema de puntos de fidelización
    points: { type: Number, default: 0, min: 0 },
    totalPointsEarned: { type: Number, default: 0, min: 0 },
    totalPointsRedeemed: { type: Number, default: 0, min: 0 },
    pointsHistory: [pointsHistorySchema],
    // Estadísticas de compra
    totalSpend: { type: Number, default: 0, min: 0 },
    totalDebt: { type: Number, default: 0, min: 0 },
    ordersCount: { type: Number, default: 0, min: 0 },
    lastPurchaseAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Índices únicos parciales - solo aplican cuando email/phone existen
customerSchema.index(
  { business: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
  }
);
customerSchema.index(
  { business: 1, phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
  }
);
customerSchema.index({ business: 1, segment: 1 });

export default mongoose.model("Customer", customerSchema);
