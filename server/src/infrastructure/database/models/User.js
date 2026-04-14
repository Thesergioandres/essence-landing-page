import mongoose from "mongoose";

const permissionActionSchema = new mongoose.Schema(
  {
    view: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    view_costs: { type: Boolean, default: false },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre es obligatorio"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "El email es obligatorio"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email inválido"],
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      minlength: [6, "La contraseña debe tener al menos 6 caracteres"],
    },
    role: {
      type: String,
      enum: [
        "user",
        "admin",
        "employee",
        "employee",
        "employee",
        "super_admin",
        "god",
      ],
      default: "user",
    },
    status: {
      type: String,
      enum: ["pending", "active", "expired", "suspended", "paused"],
      default: "pending",
    },
    subscriptionExpiresAt: {
      type: Date,
      default: null,
    },
    pausedRemainingMs: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    selectedPlan: {
      type: String,
      enum: ["starter", "pro", "enterprise"],
      default: null,
      index: true,
    },
    selectedPlanAt: {
      type: Date,
      default: null,
    },
    fixedCommissionOnly: {
      type: Boolean,
      default: false,
    },
    isCommissionFixed: {
      type: Boolean,
      default: false,
    },
    customCommissionRate: {
      type: Number,
      default: null,
      min: 0,
      max: 95,
    },
    // Matriz de permisos modular por usuario (fallback fuera de membership)
    modularPermissions: {
      type: Map,
      of: permissionActionSchema,
      default: {},
    },
    // Solo para employees
    assignedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Índices para búsquedas frecuentes
userSchema.index({ role: 1, status: 1 });
userSchema.index({ status: 1, subscriptionExpiresAt: 1 });
userSchema.index({ role: 1, active: 1 });

export { userSchema };
export default mongoose.models.User || mongoose.model("User", userSchema);
