import mongoose from "mongoose";

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
      enum: ["user", "admin", "distribuidor", "super_admin", "god"],
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
    // Solo para distribuidores
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

export default mongoose.models.User || mongoose.model("User", userSchema);
