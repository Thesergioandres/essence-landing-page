import mongoose from "mongoose";

const planLimitsSchema = new mongoose.Schema(
  {
    branches: { type: Number, default: 1, min: 1 },
    distributors: { type: Number, default: 2, min: 1 },
  },
  { _id: false },
);

const planFeaturesSchema = new mongoose.Schema(
  {
    businessAssistant: { type: Boolean, default: false },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    monthlyPrice: { type: Number, default: 0, min: 0 },
    yearlyPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "USD", trim: true },
    limits: { type: planLimitsSchema, default: () => ({}) },
    features: { type: planFeaturesSchema, default: () => ({}) },
  },
  { _id: false },
);

const globalSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      unique: true,
      default: "global",
      trim: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    defaultPlan: {
      type: String,
      enum: ["starter", "pro", "enterprise"],
      default: "starter",
    },
    plans: {
      starter: {
        type: planSchema,
        default: () => ({
          id: "starter",
          name: "Starter",
          description: "Para negocios en etapa inicial",
          monthlyPrice: 19,
          yearlyPrice: 190,
          currency: "USD",
          limits: { branches: 1, distributors: 2 },
          features: { businessAssistant: false },
        }),
      },
      pro: {
        type: planSchema,
        default: () => ({
          id: "pro",
          name: "Pro",
          description: "Para equipos que escalan ventas",
          monthlyPrice: 49,
          yearlyPrice: 490,
          currency: "USD",
          limits: { branches: 3, distributors: 10 },
          features: { businessAssistant: false },
        }),
      },
      enterprise: {
        type: planSchema,
        default: () => ({
          id: "enterprise",
          name: "Enterprise",
          description: "Para operaciones multi-sede avanzadas",
          monthlyPrice: 99,
          yearlyPrice: 990,
          currency: "USD",
          limits: { branches: 10, distributors: 50 },
          features: { businessAssistant: true },
        }),
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

const GlobalSettings =
  mongoose.models.GlobalSettings ||
  mongoose.model("GlobalSettings", globalSettingsSchema);

export default GlobalSettings;
