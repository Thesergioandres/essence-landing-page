import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    // ðŸ“ Snapshot: Nombre de la sede al momento de la venta
    branchName: {
      type: String,
      required: false,
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    customerSegment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Segment",
    },
    customerSegments: [{ type: String, trim: true }],
    customerName: { type: String, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    customerPhone: { type: String, trim: true },
    saleId: {
      type: String,
      required: true,
    },
    // AgrupaciÃ³n de ventas (carrito) - todas las ventas del mismo carrito comparten este ID
    saleGroupId: {
      type: String,
      index: true,
    },
    // Venta complementaria por garantia
    isComplementarySale: {
      type: Boolean,
      default: false,
      index: true,
    },
    parentSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
    },
    parentSaleGroupId: {
      type: String,
      trim: true,
    },
    warrantyTicketId: {
      type: String,
      trim: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    employeeNameSnapshot: {
      type: String,
      trim: true,
      default: null,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "El producto es obligatorio"],
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      index: true,
    },
    // ðŸ“¸ Snapshot: Nombre del producto al momento de la venta (para historial si se borra)
    productName: {
      type: String,
      required: false, // Opcional por ahora para compatibilidad con ventas viejas
      trim: true,
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
    // Costo promedio ponderado al momento de la venta (para cÃ¡lculo de ganancias)
    averageCostAtSale: {
      type: Number,
      default: null,
    },
    employeePrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    isPromotion: {
      type: Boolean,
      default: false,
      index: true,
    },
    promotionMetricsApplied: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Ganancias calculadas
    employeeProfit: {
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
    totalGroupProfit: {
      type: Number,
      default: 0,
    },
    // Bonus de comisiÃ³n por ranking (porcentaje adicional sobre base del 20%)
    commissionBonus: {
      type: Number,
      default: 0,
    },
    // Porcentaje total de ganancia del empleado (20%, 21%, 23%, o 25%)
    employeeProfitPercentage: {
      type: Number,
      default: 20,
    },
    commissionBonusAmount: {
      type: Number,
      default: 0,
    },
    gamificationPoints: {
      type: Number,
      default: 0,
    },
    gamificationLevel: {
      type: String,
      default: "",
    },
    gamificationPointsApplied: {
      type: Boolean,
      default: false,
    },
    // InformaciÃ³n adicional
    notes: {
      type: String,
      trim: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
    },
    sourceLocation: {
      type: String,
      enum: ["warehouse", "branch", "employee"],
      default: null,
      index: true,
    },
    // Usuario que registrÃ³ la venta (para ventas admin o cuando employee es null)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
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
    // MÃ©todo de pago personalizado
    paymentMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentMethod",
      index: true,
    },
    // CÃ³digo del mÃ©todo de pago (para compatibilidad y bÃºsquedas rÃ¡pidas)
    paymentMethodCode: {
      type: String,
      trim: true,
      index: true,
    },
    // Si es una venta a crÃ©dito (fiado)
    isCredit: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Referencia al crÃ©dito si es venta a crÃ©dito
    creditId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Credit",
    },
    // Porcentaje de rentabilidad de la venta
    // FÃ³rmula: ((precioVenta - costo) / precioVenta) * 100
    profitabilityPercentage: {
      type: Number,
      default: 0,
    },
    // Porcentaje de costo sobre venta (inverso de rentabilidad)
    // FÃ³rmula: (costo / precioVenta) * 100
    costPercentage: {
      type: Number,
      default: 0,
    },
    // ============ MÃ‰TODO DE ENTREGA ============
    // MÃ©todo de entrega personalizado
    deliveryMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryMethod",
      index: true,
    },
    // CÃ³digo del mÃ©todo de entrega (para bÃºsquedas rÃ¡pidas)
    deliveryMethodCode: {
      type: String,
      trim: true,
      index: true,
    },
    // Costo de envÃ­o/entrega
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    // DirecciÃ³n de entrega (si aplica)
    deliveryAddress: {
      type: String,
      trim: true,
    },
    // ============ COSTOS ADICIONALES ============
    // Costos adicionales por venta (garantÃ­as, obsequios, etc.)
    additionalCosts: [
      {
        type: {
          type: String, // "garantia", "obsequio", "envio", "otro"
          required: true,
        },
        description: {
          type: String,
          trim: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    // Total de costos adicionales (calculado)
    totalAdditionalCosts: {
      type: Number,
      default: 0,
    },
    // ============ PAGO REAL Y DESCUENTOS ============
    // Pago real del cliente (puede ser menor al total por descuentos)
    actualPayment: {
      type: Number,
      default: null, // null = mismo que salePrice * quantity
    },
    // Descuento aplicado al cliente
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ID de grupo de ventas (para ventas mÃºltiples con mismo descuento)
    saleGroupId: {
      type: String,
      trim: true,
      index: true,
    },
    // Referencia al pedido de venta (para ventas agrupadas)
    saleOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleOrder",
      index: true,
    },
    // ============ GANANCIAS NETAS ============
    // Ganancia neta del admin (despuÃ©s de costos adicionales, descuentos y envios)
    // FÃ³rmula: adminProfit - totalAdditionalCosts - shippingCost - discount
    netProfit: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Ãndices para acelerar listados y filtros comunes
saleSchema.index({ saleDate: -1 });
saleSchema.index({ business: 1, saleDate: -1 });
saleSchema.index({ employee: 1, saleDate: -1 });
saleSchema.index({ business: 1, employee: 1, saleDate: -1 });
saleSchema.index({ business: 1, branch: 1, saleDate: -1 });
saleSchema.index({ business: 1, product: 1, saleDate: -1 });
saleSchema.index({ business: 1, customer: 1, saleDate: -1 });
saleSchema.index({ paymentStatus: 1, saleDate: -1 });
saleSchema.index({ business: 1, paymentStatus: 1, saleDate: -1 });
saleSchema.index({ business: 1, paymentMethod: 1, saleDate: -1 });
saleSchema.index({ business: 1, paymentMethodCode: 1, saleDate: -1 });
saleSchema.index({ business: 1, isCredit: 1, saleDate: -1 });
saleSchema.index({ business: 1, deliveryMethod: 1, saleDate: -1 });
saleSchema.index({ business: 1, saleGroupId: 1 });
// Unicidad por negocio
saleSchema.index({ business: 1, saleId: 1 }, { unique: true });

// Generar saleId Ãºnico antes de guardar (DEBE SER SINCRÃ“NICO Y ANTES DE VALIDACIONES)
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
      console.warn("[Essence Debug]", 
        `âœ… saleId generado automÃ¡ticamente en pre-validate: ${this.saleId}`,
      );
    } catch (error) {
      console.error("âŒ Error generando saleId:", error?.message);
      // Pasa el error, pero no lo devuelvas directamente si quieres continuar
      // Puedes asignar un valor por defecto
      this.saleId = `FALLBACK-${Date.now()}`;
    }
  }
  next();
});

// Calcular ganancias antes de guardar
// Usamos averageCost (costo promedio ponderado) si estÃ¡ disponible, sino purchasePrice
saleSchema.pre("save", function (next) {
  // Determinar el costo a usar: averageCost del producto o purchasePrice de la venta
  // El averageCost se debe pasar como this.averageCostAtSale si se calculÃ³ antes
  const costBasis = this.averageCostAtSale || this.purchasePrice;

  if (this.isPromotion) {
    const hasEmployee = Boolean(this.employee);
    if (hasEmployee) {
      const employeePrice = Number(this.employeePrice || this.salePrice);
      this.employeeProfit =
        (this.salePrice - employeePrice) * this.quantity;
      this.adminProfit = (employeePrice - costBasis) * this.quantity;
      this.totalGroupProfit = this.employeeProfit + this.adminProfit;
      this.totalProfit = this.totalGroupProfit;
    } else {
      this.adminProfit = (this.salePrice - costBasis) * this.quantity;
      this.employeeProfit = 0;
      this.employeeProfitPercentage = 0;
      this.totalGroupProfit = this.adminProfit;
      this.totalProfit = this.totalGroupProfit;
    }
  } else if (!this.employee) {
    // Solo hay ganancia del admin: (precio de venta - costo) * cantidad
    this.adminProfit = (this.salePrice - costBasis) * this.quantity;
    this.employeeProfit = 0;
    this.employeeProfitPercentage = 0;
    this.totalGroupProfit = this.adminProfit;
    this.totalProfit = this.totalGroupProfit;
  } else {
    // Venta de empleado
    // El empleado recibe una comisiÃ³n sobre el precio de venta segÃºn su ranking
    // ðŸ¥‡ 1Âº: 25%, ðŸ¥ˆ 2Âº: 23%, ðŸ¥‰ 3Âº: 21%, Resto: 20%
    const profitPercentage = this.employeeProfitPercentage ?? 20;

    // PRECIO PARA EMPLEADO = Lo que el empleado PAGA al admin
    // Ejemplo: Venta $22,000 con 20% comisiÃ³n
    // Precio para dist = $22,000 Ã— 80% = $17,600 (lo que paga al admin)
    const priceForEmployee =
      this.salePrice * ((100 - profitPercentage) / 100);
    this.employeePrice = priceForEmployee;

    // GANANCIA DEL EMPLEADO = Precio Venta - Precio que paga al admin
    // Ejemplo: $22,000 - $17,600 = $4,400 (su comisiÃ³n del 20%)
    this.employeeProfit =
      (this.salePrice - priceForEmployee) * this.quantity;

    // GANANCIA DEL ADMIN = Precio Venta - Costo - Ganancia Empleado
    // Ejemplo: $22,000 - $10,500 - $4,400 = $7,100
    this.adminProfit =
      (this.salePrice - costBasis - (this.salePrice - priceForEmployee)) *
      this.quantity;

    // Ganancia total del grupo (admin + empleado)
    this.totalGroupProfit = this.employeeProfit + this.adminProfit;
    this.totalProfit = this.totalGroupProfit;
  }

  // Calcular total de costos adicionales
  if (this.additionalCosts && this.additionalCosts.length > 0) {
    this.totalAdditionalCosts = this.additionalCosts.reduce(
      (sum, cost) => sum + Number(cost.amount || 0),
      0,
    );
  } else {
    this.totalAdditionalCosts = 0;
  }

  // Incluir costo de envÃ­o en costos adicionales para el cÃ¡lculo
  const totalExtraCosts = this.totalAdditionalCosts + (this.shippingCost || 0);

  // Calcular ganancia neta del admin
  // netProfit = adminProfit - costos adicionales - envÃ­o - descuento
  this.netProfit = this.adminProfit - totalExtraCosts - (this.discount || 0);

  // Calcular porcentajes de rentabilidad
  // profitabilityPercentage: quÃ© % de la venta TOTAL es ganancia NETA
  // FÃ³rmula correcta financieramente: (Ganancia Neta / Total Venta) * 100
  // costPercentage: quÃ© % del precio unitario es costo base
  const totalSaleAmount = this.salePrice * this.quantity;
  if (totalSaleAmount > 0) {
    this.profitabilityPercentage = (this.netProfit / totalSaleAmount) * 100;
    this.costPercentage = (costBasis / this.salePrice) * 100;
  } else {
    this.profitabilityPercentage = 0;
    this.costPercentage = 0;
  }

  next();
});

export default mongoose.models.Sale || mongoose.model("Sale", saleSchema);

