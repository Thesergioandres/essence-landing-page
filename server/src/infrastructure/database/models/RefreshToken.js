import mongoose from "mongoose";

/**
 * Modelo RefreshToken
 * Almacena tokens de refresh para rotación segura de JWT
 * Cumple con requerimiento: JWT + Refresh Token seguro
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdByIp: {
      type: String,
    },
    revokedAt: {
      type: Date,
    },
    revokedByIp: {
      type: String,
    },
    replacedByToken: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  { timestamps: true }
);

// Índices para búsquedas eficientes (token ya tiene unique: true que crea índice)
refreshTokenSchema.index({ user: 1 });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-cleanup

// Virtual para verificar si está activo
refreshTokenSchema.virtual("isActive").get(function () {
  return !this.revokedAt && this.expiresAt > new Date();
});

// Virtual para verificar si está expirado
refreshTokenSchema.virtual("isExpired").get(function () {
  return this.expiresAt <= new Date();
});

// Método estático para revocar todos los tokens de un usuario
refreshTokenSchema.statics.revokeAllForUser = async function (userId, ip) {
  return this.updateMany(
    { user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedByIp: ip }
  );
};

// Método estático para limpiar tokens expirados
refreshTokenSchema.statics.cleanupExpired = async function () {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

refreshTokenSchema.set("toJSON", {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("RefreshToken", refreshTokenSchema);
