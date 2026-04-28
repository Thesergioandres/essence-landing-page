import mongoose from "mongoose";

const defaultPlanSeed = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Para negocios en etapa inicial",
    monthlyPrice: 19,
    yearlyPrice: 190,
    currency: "USD",
    limits: { branches: 1, employees: 2, products: 50, dailySales: 50, weeklySales: 350 },
    features: { businessAssistant: false },
    featuresList: ["Panel base", "Inventario inicial", "Ventas esenciales"],
    status: "active",
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Para equipos que escalan ventas",
    monthlyPrice: 49,
    yearlyPrice: 490,
    currency: "USD",
    limits: { branches: 3, employees: 10, products: 500, dailySales: 500, weeklySales: 3500 },
    features: { businessAssistant: false },
    featuresList: ["Multi-sede", "Gestión de equipo", "Reportes avanzados"],
    status: "active",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Para operaciones multi-sede avanzadas",
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: "USD",
    limits: { branches: 10, employees: 50, products: 5000, dailySales: 5000, weeklySales: 35000 },
    features: { businessAssistant: true },
    featuresList: [
      "Business Assistant",
      "Operación avanzada",
      "Automatización premium",
    ],
    status: "active",
  },
};

const planLimitsSchema = new mongoose.Schema(
  {
    branches: { type: Number, default: 1, min: -1 },
    employees: { type: Number, default: 2, min: -1 },
    products: { type: Number, default: 50, min: -1 },
    dailySales: { type: Number, default: 50, min: -1 },
    weeklySales: { type: Number, default: 350, min: -1 },
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
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
    limits: { type: planLimitsSchema, default: () => ({}) },
    features: { type: planFeaturesSchema, default: () => ({}) },
    featuresList: {
      type: [String],
      default: () => [],
    },
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
      default: "starter",
      trim: true,
    },
    plans: {
      type: Map,
      of: planSchema,
      default: () => ({ ...defaultPlanSeed }),
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
