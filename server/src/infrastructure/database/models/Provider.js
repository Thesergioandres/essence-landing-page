import mongoose from "mongoose";

const providerSchema = new mongoose.Schema(
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
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

providerSchema.index({ business: 1, name: 1 }, { unique: true });

export default mongoose.model("Provider", providerSchema);
