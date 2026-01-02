import mongoose from "mongoose";

const featureFlagsSchema = new mongoose.Schema(
  {
    products: { type: Boolean, default: true },
    inventory: { type: Boolean, default: true },
    sales: { type: Boolean, default: true },
    gamification: { type: Boolean, default: true },
    incidents: { type: Boolean, default: true },
    expenses: { type: Boolean, default: true },
    assistant: { type: Boolean, default: false },
    reports: { type: Boolean, default: true },
    transfers: { type: Boolean, default: true },
  },
  { _id: false }
);

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    logoPublicId: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contactWhatsapp: {
      type: String,
      trim: true,
    },
    contactLocation: {
      type: String,
      trim: true,
    },
    config: {
      features: {
        type: featureFlagsSchema,
        default: () => ({}),
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

businessSchema.index({ createdBy: 1, status: 1 });

const Business = mongoose.model("Business", businessSchema);

export default Business;
