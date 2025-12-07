import mongoose from "mongoose";

const distributionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del distribuidor es requerido"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "El monto es requerido"],
      min: [0, "El monto no puede ser negativo"],
    },
    percentage: {
      type: Number,
      min: [0, "El porcentaje no puede ser negativo"],
      max: [100, "El porcentaje no puede ser mayor a 100"],
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const specialSaleSchema = new mongoose.Schema(
  {
    product: {
      name: {
        type: String,
        required: [true, "El nombre del producto es requerido"],
        trim: true,
      },
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    },
    quantity: {
      type: Number,
      required: [true, "La cantidad es requerida"],
      min: [1, "La cantidad debe ser al menos 1"],
      default: 1,
    },
    specialPrice: {
      type: Number,
      required: [true, "El precio especial es requerido"],
      min: [0, "El precio no puede ser negativo"],
    },
    cost: {
      type: Number,
      required: [true, "El costo es requerido"],
      min: [0, "El costo no puede ser negativo"],
    },
    totalProfit: {
      type: Number,
      required: true,
      min: [0, "La ganancia total no puede ser negativa"],
    },
    distribution: {
      type: [distributionSchema],
      required: [true, "La distribución es requerida"],
      validate: {
        validator: function (distributions) {
          return distributions && distributions.length > 0;
        },
        message: "Debe haber al menos un distribuidor en la distribución",
      },
    },
    observations: {
      type: String,
      trim: true,
      maxlength: [1000, "Las observaciones no pueden exceder 1000 caracteres"],
    },
    eventName: {
      type: String,
      trim: true,
      maxlength: [200, "El nombre del evento no puede exceder 200 caracteres"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "refunded"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Validación personalizada: suma de distribuciones debe igualar ganancia total
specialSaleSchema.pre("save", function (next) {
  // Calcular ganancia total
  this.totalProfit = this.specialPrice * this.quantity - this.cost * this.quantity;

  // Verificar que la suma de distribuciones coincida con la ganancia total
  const distributionSum = this.distribution.reduce(
    (sum, dist) => sum + dist.amount,
    0
  );

  const tolerance = 0.01; // Tolerancia de 1 centavo para errores de redondeo
  if (Math.abs(distributionSum - this.totalProfit) > tolerance) {
    next(
      new Error(
        `La suma de distribuciones ($${distributionSum.toFixed(2)}) no coincide con la ganancia total ($${this.totalProfit.toFixed(2)})`
      )
    );
  } else {
    next();
  }
});

// Índices para búsquedas eficientes
specialSaleSchema.index({ saleDate: -1 });
specialSaleSchema.index({ createdBy: 1 });
specialSaleSchema.index({ "product.name": 1 });
specialSaleSchema.index({ status: 1 });

// Virtual para obtener el total de la venta
specialSaleSchema.virtual("totalSale").get(function () {
  return this.specialPrice * this.quantity;
});

// Virtual para obtener el costo total
specialSaleSchema.virtual("totalCost").get(function () {
  return this.cost * this.quantity;
});

// Método estático para obtener estadísticas de ventas especiales
specialSaleSchema.statics.getStatistics = async function (startDate, endDate) {
  const match = {
    status: "active",
  };

  if (startDate || endDate) {
    match.saleDate = {};
    if (startDate) match.saleDate.$gte = new Date(startDate);
    if (endDate) match.saleDate.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSales: { $sum: { $multiply: ["$specialPrice", "$quantity"] } },
        totalCosts: { $sum: { $multiply: ["$cost", "$quantity"] } },
        totalProfit: { $sum: "$totalProfit" },
        count: { $sum: 1 },
        averageSale: { $avg: { $multiply: ["$specialPrice", "$quantity"] } },
      },
    },
  ]);

  return stats[0] || {
    totalSales: 0,
    totalCosts: 0,
    totalProfit: 0,
    count: 0,
    averageSale: 0,
  };
};

// Método estático para obtener distribución por persona
specialSaleSchema.statics.getDistributionByPerson = async function (
  startDate,
  endDate
) {
  const match = {
    status: "active",
  };

  if (startDate || endDate) {
    match.saleDate = {};
    if (startDate) match.saleDate.$gte = new Date(startDate);
    if (endDate) match.saleDate.$lte = new Date(endDate);
  }

  const distribution = await this.aggregate([
    { $match: match },
    { $unwind: "$distribution" },
    {
      $group: {
        _id: "$distribution.name",
        totalAmount: { $sum: "$distribution.amount" },
        salesCount: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  return distribution;
};

const SpecialSale = mongoose.model("SpecialSale", specialSaleSchema);

export default SpecialSale;
