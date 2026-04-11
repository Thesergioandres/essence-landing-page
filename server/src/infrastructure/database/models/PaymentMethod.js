import mongoose from "mongoose";

/**
 * Modelo PaymentMethod
 * Permite a cada negocio definir sus propios métodos de pago personalizados
 * Los métodos de pago "cash" y "credit" son reservados del sistema
 */
const paymentMethodSchema = new mongoose.Schema(
  {
    // Negocio al que pertenece
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "El negocio es obligatorio"],
      index: true,
    },
    // Nombre del método de pago (ej: "Nequi", "Daviplata", "Bancolombia", "Efectivo", "Crédito")
    name: {
      type: String,
      required: [true, "El nombre del método de pago es obligatorio"],
      trim: true,
      maxlength: [50, "El nombre no puede exceder 50 caracteres"],
    },
    // Código único interno (slug) - se genera automáticamente
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    // Descripción opcional
    description: {
      type: String,
      trim: true,
      maxlength: [200, "La descripción no puede exceder 200 caracteres"],
    },
    // Si es método de crédito/fiado (afecta métricas y flujos de crédito)
    isCredit: {
      type: Boolean,
      default: false,
    },
    // Si requiere confirmación de pago (ej: transferencias)
    requiresConfirmation: {
      type: Boolean,
      default: false,
    },
    // Si requiere comprobante de pago
    requiresProof: {
      type: Boolean,
      default: false,
    },
    // Icono del método (nombre de icono de lucide-react o emoji)
    icon: {
      type: String,
      trim: true,
      default: "wallet",
    },
    // Color para UI (hex)
    color: {
      type: String,
      trim: true,
      default: "#8B5CF6", // purple-500
    },
    // Si está activo
    isActive: {
      type: Boolean,
      default: true,
    },
    // Orden de visualización
    displayOrder: {
      type: Number,
      default: 0,
    },
    // Si es método por defecto del sistema (no editable)
    isSystem: {
      type: Boolean,
      default: false,
    },
    // Creado por
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Índices
paymentMethodSchema.index({ business: 1, code: 1 }, { unique: true });
paymentMethodSchema.index({ business: 1, isActive: 1, displayOrder: 1 });

// Generar código slug antes de validar
paymentMethodSchema.pre("validate", function (next) {
  if (this.name && !this.code) {
    // Generar slug a partir del nombre
    this.code = this.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar acentos
      .replace(/[^a-z0-9]+/g, "-") // Reemplazar caracteres especiales por guiones
      .replace(/^-+|-+$/g, ""); // Quitar guiones al inicio y final
  }
  next();
});

// Método estático para crear métodos por defecto para un negocio
paymentMethodSchema.statics.createDefaultMethods = async function (
  businessId,
  userId
) {
  const defaultMethods = [
    {
      business: businessId,
      name: "Efectivo",
      code: "cash",
      description: "Pago en efectivo",
      isCredit: false,
      requiresConfirmation: false,
      requiresProof: false,
      icon: "banknote",
      color: "#22C55E", // green-500
      isActive: true,
      displayOrder: 1,
      isSystem: true,
      createdBy: userId,
    },
    {
      business: businessId,
      name: "Crédito / Fiado",
      code: "credit",
      description: "Venta a crédito o fiado",
      isCredit: true,
      requiresConfirmation: false,
      requiresProof: false,
      icon: "credit-card",
      color: "#EF4444", // red-500
      isActive: true,
      displayOrder: 2,
      isSystem: true,
      createdBy: userId,
    },
    {
      business: businessId,
      name: "Transferencia",
      code: "transfer",
      description: "Transferencia bancaria",
      isCredit: false,
      requiresConfirmation: true,
      requiresProof: true,
      icon: "arrow-right-left",
      color: "#3B82F6", // blue-500
      isActive: true,
      displayOrder: 3,
      isSystem: false,
      createdBy: userId,
    },
  ];

  const methods = [];
  for (const method of defaultMethods) {
    try {
      const existing = await this.findOne({
        business: businessId,
        code: method.code,
      });
      if (!existing) {
        const created = await this.create(method);
        methods.push(created);
      } else {
        methods.push(existing);
      }
    } catch (error) {
      console.error(
        `Error creando método de pago ${method.name}:`,
        error.message
      );
    }
  }
  return methods;
};

export default mongoose.model("PaymentMethod", paymentMethodSchema);
