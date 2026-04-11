import mongoose from "mongoose";

const rewardSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: { type: Number, default: 1, min: 1 },
    discountType: {
      type: String,
      enum: ["percentage", "amount", "free"],
      default: "percentage",
    },
    discountValue: { type: Number, default: 0 },
  },
  { _id: false },
);

const ruleThresholdSchema = new mongoose.Schema(
  {
    minQty: { type: Number, default: 0 },
    minSubtotal: { type: Number, default: 0 },
  },
  { _id: false },
);

const volumeRuleSchema = new mongoose.Schema(
  {
    minQty: { type: Number, default: 0 },
    discountType: {
      type: String,
      enum: ["percentage", "amount"],
      default: "percentage",
    },
    discountValue: { type: Number, default: 0 },
  },
  { _id: false },
);

const promotionSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Imagen de la promoción
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    type: {
      type: String,
      enum: ["bogo", "combo", "volume", "discount", "bundle"],
      default: "discount",
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "archived"],
      default: "active",
      index: true,
    },
    exclusive: { type: Boolean, default: false },
    startDate: { type: Date },
    endDate: { type: Date },
    branches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Branch" }],
    allowAllLocations: { type: Boolean, default: true },
    allowedLocations: [{ type: mongoose.Schema.Types.ObjectId, ref: "Branch" }],
    allowAllDistributors: { type: Boolean, default: true },
    allowedDistributors: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    segments: [{ type: String, trim: true }],
    customers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Customer" }],

    // Para tipo BOGO (Buy One Get One)
    buyItems: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, default: 1, min: 1 },
      },
    ],
    rewardItems: [rewardSchema],

    // Para tipo COMBO/BUNDLE - productos incluidos con sus cantidades y precios
    comboItems: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, default: 1, min: 1 },
        unitPrice: { type: Number, default: 0 }, // Precio por unidad en el combo
      },
    ],

    // Precio total de la promoción/bundle
    promotionPrice: { type: Number, default: 0 },
    // Precio para distribuidores (B2B)
    distributorPrice: { type: Number, default: 0 },
    // Precio original (suma de precios individuales) para mostrar ahorro
    originalPrice: { type: Number, default: 0 },

    discount: {
      type: {
        type: String,
        enum: ["percentage", "amount"],
        default: "percentage",
      },
      value: { type: Number, default: 0 },
    },
    thresholds: ruleThresholdSchema,
    volumeRule: volumeRuleSchema,

    // Control de stock y límites
    totalStock: { type: Number, default: null }, // null = ilimitado
    currentStock: { type: Number, default: null },
    usageLimit: { type: Number, default: null }, // Límite total de usos
    usageLimitPerCustomer: { type: Number, default: null }, // Límite por cliente

    // Orden de visualización en catálogo
    displayOrder: { type: Number, default: 0 },
    // Mostrar en catálogo público
    showInCatalog: { type: Boolean, default: true },

    financialImpact: {
      expectedMargin: { type: Number },
      distributorCommission: { type: Number },
      notes: { type: String },
    },

    // Métricas
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
    totalRevenue: { type: Number, default: 0 }, // Ingresos totales generados
    totalUnitsSold: { type: Number, default: 0 }, // Unidades vendidas

    // Auditoría
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

promotionSchema.index({ business: 1, status: 1, type: 1 });
promotionSchema.index({ business: 1, startDate: 1, endDate: 1 });

// Prevent OverwriteModelError
const Promotion =
  mongoose.models.Promotion || mongoose.model("Promotion", promotionSchema);
export default Promotion;
