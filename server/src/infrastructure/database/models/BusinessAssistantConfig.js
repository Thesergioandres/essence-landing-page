import mongoose from "mongoose";

const businessAssistantConfigSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
    },
    // Ventanas por defecto
    horizonDaysDefault: { type: Number, default: 90, min: 1 },
    recentDaysDefault: { type: Number, default: 30, min: 1 },

    // Caché
    cacheEnabled: { type: Boolean, default: true },
    cacheTtlSeconds: { type: Number, default: 300, min: 0 },

    // Reglas / umbrales
    daysCoverLowThreshold: { type: Number, default: 14, min: 1 },
    buyTargetDays: { type: Number, default: 30, min: 1 },

    lowRotationUnitsThreshold: { type: Number, default: 1, min: 0 },
    highStockMultiplier: { type: Number, default: 2, min: 1 },
    highStockMinUnits: { type: Number, default: 10, min: 0 },

    trendDropThresholdPct: { type: Number, default: -20 }, // porcentaje
    trendGrowthThresholdPct: { type: Number, default: 20 }, // porcentaje
    minUnitsForGrowthStrategy: { type: Number, default: 10, min: 0 },

    marginLowThresholdPct: { type: Number, default: 15, min: 0 }, // porcentaje

    // Objetivos de pricing (margen sobre ingresos)
    targetMarginPct: { type: Number, default: 25, min: 0 },
    minMarginAfterDiscountPct: { type: Number, default: 10, min: 0 },

    priceHighVsCategoryThresholdPct: { type: Number, default: 10 }, // porcentaje
    priceLowVsCategoryThresholdPct: { type: Number, default: -10 }, // porcentaje

    decreasePricePct: { type: Number, default: -5 },
    promotionDiscountPct: { type: Number, default: -10 },
    increasePricePct: { type: Number, default: 5 },

    // Señales y ajustes avanzados
    newProductGraceDays: { type: Number, default: 14, min: 0 },
    minRecentUnitsForPriceChange: { type: Number, default: 3, min: 0 },
    minRecentUnitsForDemandSignal: { type: Number, default: 5, min: 0 },
    priceElasticity: { type: Number, default: 0.25, min: 0 },
    clearanceDiscountPct: { type: Number, default: -20 },

    // Clasificacion ABC (porcentaje acumulado)
    abcClassAThreshold: { type: Number, default: 0.8, min: 0, max: 1 },
    abcClassBThreshold: { type: Number, default: 0.95, min: 0, max: 1 },

    // Overrides por categoria o producto
    categoryOverrides: {
      type: [
        {
          categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
          targetMarginPct: Number,
          daysCoverLowThreshold: Number,
          buyTargetDays: Number,
          priceHighVsCategoryThresholdPct: Number,
          priceLowVsCategoryThresholdPct: Number,
        },
      ],
      default: [],
    },
    productOverrides: {
      type: [
        {
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          targetMarginPct: Number,
          daysCoverLowThreshold: Number,
          buyTargetDays: Number,
          priceHighVsCategoryThresholdPct: Number,
          priceLowVsCategoryThresholdPct: Number,
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

businessAssistantConfigSchema.index(
  { business: 1 },
  { unique: true, sparse: true },
);

const BusinessAssistantConfig = mongoose.model(
  "BusinessAssistantConfig",
  businessAssistantConfigSchema,
);

export default BusinessAssistantConfig;
