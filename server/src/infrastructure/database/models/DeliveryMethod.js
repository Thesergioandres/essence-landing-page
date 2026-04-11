import mongoose from "mongoose";

/**
 * Modelo DeliveryMethod
 * Permite a cada negocio definir sus propios métodos de entrega personalizados
 * Ejemplos: Portería, Envío allá, Envío acá, Domicilio, etc.
 */
const deliveryMethodSchema = new mongoose.Schema(
  {
    // Negocio al que pertenece
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "El negocio es obligatorio"],
      index: true,
    },
    // Nombre del método de entrega (ej: "Portería", "Domicilio", "Envío allá")
    name: {
      type: String,
      required: [true, "El nombre del método de entrega es obligatorio"],
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
    // Costo por defecto del método de entrega (puede sobrescribirse en la venta)
    defaultCost: {
      type: Number,
      default: 0,
      min: [0, "El costo no puede ser negativo"],
    },
    // Si el costo es variable (el usuario lo ingresa en cada venta)
    hasVariableCost: {
      type: Boolean,
      default: false,
    },
    // Si requiere dirección de entrega
    requiresAddress: {
      type: Boolean,
      default: false,
    },
    // Tiempo estimado de entrega (en horas o días, según el negocio)
    estimatedTime: {
      type: String,
      trim: true,
      maxlength: [50, "El tiempo estimado no puede exceder 50 caracteres"],
    },
    // Icono del método (nombre de icono de lucide-react o emoji)
    icon: {
      type: String,
      trim: true,
      default: "truck",
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
deliveryMethodSchema.index({ business: 1, code: 1 }, { unique: true });
deliveryMethodSchema.index({ business: 1, isActive: 1, displayOrder: 1 });

// Generar código slug antes de validar
deliveryMethodSchema.pre("validate", function (next) {
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
deliveryMethodSchema.statics.createDefaultMethods = async function (
  businessId,
  userId
) {
  const defaultMethods = [
    {
      business: businessId,
      name: "Personal / En tienda",
      code: "personal",
      description: "Cliente compra y recoge en el local",
      defaultCost: 0,
      hasVariableCost: false,
      requiresAddress: false,
      icon: "store",
      color: "#10B981", // green-500
      isActive: true,
      displayOrder: 1,
      isSystem: true,
      createdBy: userId,
    },
    {
      business: businessId,
      name: "Portería",
      code: "porteria",
      description: "Entrega en portería del edificio",
      defaultCost: 0,
      hasVariableCost: false,
      requiresAddress: true,
      icon: "building",
      color: "#22C55E", // green-500
      isActive: true,
      displayOrder: 2,
      isSystem: true,
      createdBy: userId,
    },
    {
      business: businessId,
      name: "Envío allá",
      code: "envio-alla",
      description: "Envío a la dirección del cliente",
      defaultCost: 0,
      hasVariableCost: true,
      requiresAddress: true,
      icon: "send",
      color: "#3B82F6", // blue-500
      isActive: true,
      displayOrder: 3,
      isSystem: true,
      createdBy: userId,
    },
    {
      business: businessId,
      name: "Envío acá",
      code: "envio-aca",
      description: "El cliente recoge en nuestra ubicación",
      defaultCost: 0,
      hasVariableCost: false,
      requiresAddress: false,
      icon: "package",
      color: "#8B5CF6", // purple-500
      isActive: true,
      displayOrder: 4,
      isSystem: true,
      createdBy: userId,
    },
    {
      business: businessId,
      name: "Domicilio",
      code: "domicilio",
      description: "Entrega a domicilio",
      defaultCost: 0,
      hasVariableCost: true,
      requiresAddress: true,
      icon: "truck",
      color: "#F59E0B", // amber-500
      isActive: true,
      displayOrder: 5,
      isSystem: true,
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
        `Error creando método de entrega ${method.name}:`,
        error.message
      );
    }
  }
  return methods;
};

export default mongoose.model("DeliveryMethod", deliveryMethodSchema);
