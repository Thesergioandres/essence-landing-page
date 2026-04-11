import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
    },
    timezone: {
      type: String,
      default: "America/Bogota",
    },
    config: {
      ticketPrefix: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    isWarehouse: {
      type: Boolean,
      default: false,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

branchSchema.index({ business: 1, name: 1 }, { unique: true });

export default mongoose.model("Branch", branchSchema);
