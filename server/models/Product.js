import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del producto es obligatorio"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "La descripción es obligatoria"],
    },
    // Precios
    purchasePrice: {
      type: Number,
      required: [true, "El precio de compra es obligatorio"],
      min: [0, "El precio de compra no puede ser negativo"],
    },
    suggestedPrice: {
      type: Number,
      default: function () {
        return this.purchasePrice * 1.3; // 30% automático
      },
    },
    distributorPrice: {
      type: Number,
      required: [true, "El precio para distribuidor es obligatorio"],
      min: [0, "El precio para distribuidor no puede ser negativo"],
    },
    clientPrice: {
      type: Number,
      min: [0, "El precio para cliente no puede ser negativo"],
    },
    distributorCommission: {
      type: Number,
      default: 0,
      min: [0, "La comisión no puede ser negativa"],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "La categoría es obligatoria"],
    },
    image: {
      url: String,
      publicId: String,
    },
    // Stock
    totalStock: {
      type: Number,
      default: 0,
      min: [0, "El stock no puede ser negativo"],
    },
    warehouseStock: {
      type: Number,
      default: 0,
      min: [0, "El stock en bodega no puede ser negativo"],
    },
    lowStockAlert: {
      type: Number,
      default: 10,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    ingredients: [String],
    benefits: [String],
  },
  {
    timestamps: true,
  }
);

// Índices para optimizar consultas
productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ featured: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ warehouseStock: 1 });

export default mongoose.model("Product", productSchema);
