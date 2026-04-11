import mongoose from "mongoose";

/**
 * Modelo de suscripción push para notificaciones web
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    subscription: {
      endpoint: {
        type: String,
        required: true,
      },
      expirationTime: {
        type: Number,
        default: null,
      },
      keys: {
        p256dh: {
          type: String,
          required: true,
        },
        auth: {
          type: String,
          required: true,
        },
      },
    },
    userAgent: {
      type: String,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
    // Preferencias de notificación
    preferences: {
      sales: { type: Boolean, default: true },
      stock: { type: Boolean, default: true },
      credits: { type: Boolean, default: true },
      subscriptions: { type: Boolean, default: true },
      gamification: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

// Índice único para evitar duplicados
pushSubscriptionSchema.index(
  { user: 1, "subscription.endpoint": 1 },
  { unique: true }
);

// Método para verificar si la suscripción está activa
pushSubscriptionSchema.methods.isActive = function () {
  if (!this.active) return false;
  if (this.subscription.expirationTime) {
    return this.subscription.expirationTime > Date.now();
  }
  return true;
};

// Método para actualizar última utilización
pushSubscriptionSchema.methods.markUsed = async function () {
  this.lastUsed = new Date();
  await this.save();
};

// Estático para limpiar suscripciones inactivas
pushSubscriptionSchema.statics.cleanupInactive = async function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    $or: [
      { active: false },
      { lastUsed: { $lt: cutoffDate } },
      {
        "subscription.expirationTime": { $lt: Date.now() },
      },
    ],
  });

  return result.deletedCount;
};

const PushSubscription = mongoose.model(
  "PushSubscription",
  pushSubscriptionSchema
);

export default PushSubscription;
