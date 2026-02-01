import mongoose from "mongoose";

const pointsHistorySchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["earned", "redeemed", "bonus", "adjustment", "expired"],
      required: true,
    },
    amount: { type: Number, required: true },
    balance: { type: Number, required: true },
    description: { type: String },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "referenceModel",
    },
    referenceModel: { type: String, enum: ["Sale", "User", null] },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  },
);

pointsHistorySchema.index({ customer: 1, createdAt: -1 });
pointsHistorySchema.index({ business: 1, customer: 1, createdAt: -1 });
pointsHistorySchema.index({ type: 1, createdAt: -1 });

export default mongoose.model("PointsHistory", pointsHistorySchema);
