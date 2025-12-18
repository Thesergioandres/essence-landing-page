import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    saleId: {
      type: String,
      unique: true,
      required: true,
    },
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "El producto es obligatorio"],
    },
    quantity: {
      type: Number,
      required: [true, "La cantidad es obligatoria"],
      min: [1, "La cantidad debe ser al menos 1"],
    },
    // Precios al momento de la venta
    purchasePrice: {
      type: Number,
      required: true,
    },
    distributorPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    // Ganancias calculadas
    distributorProfit: {
      type: Number,
      default: 0,
    },
    adminProfit: {
      type: Number,
      default: 0,
    },
    totalProfit: {
      type: Number,
      default: 0,
    },
    // Bonus de comisión por ranking (porcentaje adicional sobre base del 20%)
    commissionBonus: {
      type: Number,
      default: 0,
    },
    // Porcentaje total de ganancia del distribuidor (20%, 21%, 23%, o 25%)
    distributorProfitPercentage: {
      type: Number,
      default: 20,
    },
    commissionBonusAmount: {
      type: Number,
      default: 0,
    },
    // Información adicional
    notes: {
      type: String,
      trim: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
    },
    // Estado de pago
    paymentStatus: {
      type: String,
      enum: ["pendiente", "confirmado"],
      default: "pendiente",
    },
    paymentConfirmedAt: {
      type: Date,
    },
    paymentConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Comprobante de transferencia
    paymentProof: {
      type: String, // Base64 de la imagen
      default: null,
    },
    paymentProofMimeType: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para acelerar listados y filtros comunes
saleSchema.index({ saleDate: -1 });
saleSchema.index({ distributor: 1, saleDate: -1 });
saleSchema.index({ paymentStatus: 1, saleDate: -1 });

// Generar saleId único antes de guardar (DEBE SER SINCRÓNICO Y ANTES DE VALIDACIONES)
saleSchema.pre("validate", function (next) {
  // Generar saleId si no existe - SE EJECUTA ANTES DE VALIDACIONES
  if (!this.saleId) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();

      this.saleId = `SALE-${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
      console.log(
        `✅ saleId generado automáticamente en pre-validate: ${this.saleId}`
      );
    } catch (error) {
      console.error("❌ Error generando saleId:", error?.message);
      // Pasa el error, pero no lo devuelvas directamente si quieres continuar
      // Puedes asignar un valor por defecto
      this.saleId = `FALLBACK-${Date.now()}`;
    }
  }
  next();
});

// Calcular ganancias antes de guardar
saleSchema.pre("save", function (next) {
  // Si es venta admin (sin distribuidor)
  if (!this.distributor) {
    // Solo hay ganancia del admin: (precio de venta - precio de compra) * cantidad
    this.adminProfit = (this.salePrice - this.purchasePrice) * this.quantity;
    this.distributorProfit = 0;
    this.distributorProfitPercentage = 0;
    this.totalProfit = this.adminProfit;
  } else {
    // Venta de distribuidor
    // El distribuidor recibe una comisión sobre el precio de venta según su ranking
    // 🥇 1º: 25%, 🥈 2º: 23%, 🥉 3º: 21%, Resto: 20%
    const profitPercentage = this.distributorProfitPercentage || 20;

    // PRECIO PARA DISTRIBUIDOR = Lo que el distribuidor PAGA al admin
    // Ejemplo: Venta $22,000 con 20% comisión
    // Precio para dist = $22,000 × 80% = $17,600 (lo que paga al admin)
    const priceForDistributor =
      this.salePrice * ((100 - profitPercentage) / 100);
    this.distributorPrice = priceForDistributor;

    // GANANCIA DEL DISTRIBUIDOR = Precio Venta - Precio que paga al admin
    // Ejemplo: $22,000 - $17,600 = $4,400 (su comisión del 20%)
    this.distributorProfit =
      (this.salePrice - priceForDistributor) * this.quantity;

    // GANANCIA DEL ADMIN = Precio Venta - Precio Compra - Ganancia Distribuidor
    // Ejemplo: $22,000 - $10,500 - $4,400 = $7,100
    this.adminProfit =
      (this.salePrice -
        this.purchasePrice -
        (this.salePrice - priceForDistributor)) *
      this.quantity;

    // Ganancia total
    this.totalProfit = this.distributorProfit + this.adminProfit;
  }

  next();
});

export default mongoose.model("Sale", saleSchema);
