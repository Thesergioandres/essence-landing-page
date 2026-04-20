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
    // 📍 Snapshot: Nombre de la sede al momento de la venta
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
    // Agrupación de ventas (carrito) - todas las ventas del mismo carrito comparten este ID
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
    // 📸 Snapshot: Nombre del producto al momento de la venta (para historial si se borra)
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
    // Costo promedio ponderado al momento de la venta (para cálculo de ganancias)
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
    // Snapshot explícito del precio unitario final vendido
    unitPrice: {
      type: Number,
      default: null,
    },
    // Snapshot del total bruto por línea (unitPrice * quantity)
    totalPrice: {
      type: Number,
      default: null,
    },
    // Snapshot de costo usado para la rentabilidad de la línea
    costAtSale: {
      type: Number,
      default: null,
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
    // Bonus de comisión variable (porcentaje adicional sobre la base)
    commissionBonus: {
      type: Number,
      default: 0,
    },
    // Porcentaje total de ganancia del employee
    employeeProfitPercentage: {
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
    sourceLocation: {
      type: String,
      enum: ["warehouse", "branch", "employee"],
      default: null,
      index: true,
    },
    // Usuario que registró la venta (para ventas admin o cuando employee es null)
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
    // Método de pago personalizado
    paymentMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentMethod",
      index: true,
    },
    // Código del método de pago (para compatibilidad y búsquedas rápidas)
    paymentMethodCode: {
      type: String,
      trim: true,
      index: true,
    },
    // Si es una venta a crédito (fiado)
    isCredit: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Referencia al crédito si es venta a crédito
    creditId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Credit",
    },
    // Porcentaje de rentabilidad de la venta
    // Fórmula: ((precioVenta - costo) / precioVenta) * 100
    profitabilityPercentage: {
      type: Number,
      default: 0,
    },
    // Porcentaje de costo sobre venta (inverso de rentabilidad)
    // Fórmula: (costo / precioVenta) * 100
    costPercentage: {
      type: Number,
      default: 0,
    },
    // ============ MÉTODO DE ENTREGA ============
    // Método de entrega personalizado
    deliveryMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryMethod",
      index: true,
    },
    // Código del método de entrega (para búsquedas rápidas)
    deliveryMethodCode: {
      type: String,
      trim: true,
      index: true,
    },
    // Costo de envío/entrega
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Dirección de entrega (si aplica)
    deliveryAddress: {
      type: String,
      trim: true,
    },
    // ============ COSTOS ADICIONALES ============
    // Costos adicionales por venta (garantías, obsequios, etc.)
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
    // ID de grupo de ventas (para ventas múltiples con mismo descuento)
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
    // Ganancia neta del admin (después de costos adicionales, descuentos y envios)
    // Fórmula: adminProfit - totalAdditionalCosts - shippingCost - discount
    netProfit: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Índices para acelerar listados y filtros comunes
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
        `✅ saleId generado automáticamente en pre-validate: ${this.saleId}`,
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
// Usamos averageCost (costo promedio ponderado) si está disponible, sino purchasePrice
saleSchema.pre("save", function (next) {
  const normalizedUnitPrice = Number(this.unitPrice);
  if (!Number.isFinite(normalizedUnitPrice) || normalizedUnitPrice <= 0) {
    this.unitPrice = Number(this.salePrice || 0);
  }

  const normalizedSalePrice = Number(this.salePrice);
  if (normalizedSalePrice <= 0 && Number(this.unitPrice || 0) > 0) {
    this.salePrice = Number(this.unitPrice);
  }

  const normalizedTotalPrice = Number(this.totalPrice);
  if (!Number.isFinite(normalizedTotalPrice) || normalizedTotalPrice < 0) {
    this.totalPrice =
      Number(this.unitPrice || this.salePrice || 0) *
      Number(this.quantity || 0);
  }

  const normalizedCostAtSale = Number(this.costAtSale);
  if (!Number.isFinite(normalizedCostAtSale) || normalizedCostAtSale < 0) {
    this.costAtSale = Number(this.averageCostAtSale ?? this.purchasePrice ?? 0);
  }

  const normalizedAverageCost = Number(this.averageCostAtSale);
  if (!Number.isFinite(normalizedAverageCost) || normalizedAverageCost < 0) {
    this.averageCostAtSale = Number(this.costAtSale || this.purchasePrice || 0);
  }

  // Determinar el costo a usar: averageCost del producto o purchasePrice de la venta
  // El averageCost se debe pasar como this.averageCostAtSale si se calculó antes
  const costBasis = Number(
    this.costAtSale || this.averageCostAtSale || this.purchasePrice || 0,
  );

  if (this.isPromotion) {
    const hasEmployee = Boolean(this.employee);
    if (hasEmployee) {
      const employeePrice = Number(this.employeePrice || this.salePrice);
      this.employeeProfit = (this.salePrice - employeePrice) * this.quantity;
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
    // Venta de employee
    // El employee recibe una comisión sobre el precio de venta según su ranking
    // 🥇 1º: 25%, 🥈 2º: 23%, 🥉 3º: 21%, Resto: 20%
    const normalizedSalePriceForEmployeeFlow = Number(this.salePrice || 0);
    const explicitPercentage = Number(this.employeeProfitPercentage);
    const hasExplicitPercentage = Number.isFinite(explicitPercentage);

    const rawEmployeePrice = Number(this.employeePrice);
    const hasPersistedEmployeePrice =
      Number.isFinite(rawEmployeePrice) &&
      rawEmployeePrice >= 0 &&
      rawEmployeePrice <= normalizedSalePriceForEmployeeFlow;

    const shouldUsePersistedEmployeePrice =
      !hasExplicitPercentage && hasPersistedEmployeePrice;

    const derivedPercentageFromPrice =
      shouldUsePersistedEmployeePrice && normalizedSalePriceForEmployeeFlow > 0
        ? ((normalizedSalePriceForEmployeeFlow - rawEmployeePrice) /
            normalizedSalePriceForEmployeeFlow) *
          100
        : null;

    const normalizedProfitPercentage = hasExplicitPercentage
      ? explicitPercentage
      : Number.isFinite(derivedPercentageFromPrice)
        ? derivedPercentageFromPrice
        : 0;

    const profitPercentage = Math.max(
      0,
      Math.min(95, normalizedProfitPercentage),
    );
    this.employeeProfitPercentage = profitPercentage;

    // PRECIO PARA EMPLOYEE = Lo que el employee PAGA al admin
    // Ejemplo: Venta $22,000 con 20% comisión
    // Precio para dist = $22,000 × 80% = $17,600 (lo que paga al admin)
    const priceForEmployee = shouldUsePersistedEmployeePrice
      ? rawEmployeePrice
      : normalizedSalePriceForEmployeeFlow * ((100 - profitPercentage) / 100);
    this.employeePrice = priceForEmployee;

    // GANANCIA DEL EMPLOYEE = Precio Venta - Precio que paga al admin
    // Ejemplo: $22,000 - $17,600 = $4,400 (su comisión del 20%)
    this.employeeProfit =
      (normalizedSalePriceForEmployeeFlow - priceForEmployee) * this.quantity;

    // GANANCIA DEL ADMIN = Precio Venta - Costo - Ganancia Employee
    // Ejemplo: $22,000 - $10,500 - $4,400 = $7,100
    const employeeCommissionPerUnit =
      normalizedSalePriceForEmployeeFlow - priceForEmployee;
    this.adminProfit =
      (normalizedSalePriceForEmployeeFlow -
        costBasis -
        employeeCommissionPerUnit) *
      this.quantity;

    // Ganancia total del grupo (admin + employee)
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

  // Incluir costo de envío en costos adicionales para el cálculo
  const totalExtraCosts = this.totalAdditionalCosts + (this.shippingCost || 0);

  // Calcular ganancia neta del admin
  // netProfit = adminProfit - costos adicionales - envío - descuento
  this.netProfit = this.adminProfit - totalExtraCosts - (this.discount || 0);

  // Calcular porcentajes de rentabilidad
  // profitabilityPercentage: qué % de la venta TOTAL es ganancia NETA
  // Fórmula correcta financieramente: (Ganancia Neta / Total Venta) * 100
  // costPercentage: qué % del precio unitario es costo base
  const totalSaleAmount = Number(
    this.totalPrice || this.salePrice * this.quantity || 0,
  );
  if (totalSaleAmount > 0) {
    this.profitabilityPercentage = (this.netProfit / totalSaleAmount) * 100;
    this.costPercentage =
      this.salePrice > 0 ? (costBasis / this.salePrice) * 100 : 0;
  } else {
    this.profitabilityPercentage = 0;
    this.costPercentage = 0;
  }

  next();
});

export default mongoose.models.Sale || mongoose.model("Sale", saleSchema);
