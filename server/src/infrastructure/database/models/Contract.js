import mongoose from "mongoose";

const contractSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    signatureData: {
      type: String,
      required: true,
    },
    photoData: {
      type: String,
      required: true,
    },
    signedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    isLocked: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

contractSchema.index({ business: 1, signedBy: 1, signedAt: -1 });
contractSchema.index({ business: 1, createdAt: -1 });

export default mongoose.models.Contract ||
  mongoose.model("Contract", contractSchema);
