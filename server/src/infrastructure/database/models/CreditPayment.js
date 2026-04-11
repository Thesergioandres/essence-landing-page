import mongoose from "mongoose";

/**
 * Modelo CreditPayment
 * Registra pagos parciales o totales de un fiado/crédito
 */
const creditPaymentSchema = new mongoose.Schema(
  {
    // Referencia al crédito
    credit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Credit",
      required: [true, "El crédito es obligatorio"],
    },
    // Negocio al que pertenece
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "El negocio es obligatorio"],
    },
    // Monto del pago
    amount: {
      type: Number,
      required: [true, "El monto es obligatorio"],
      min: [0.01, "El monto debe ser mayor a 0"],
    },
    // Método de pago
    paymentMethod: {
      type: String,
      enum: ["cash", "transfer", "card", "other"],
      default: "cash",
    },
    // Usuario que registró el pago
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Sede donde se realizó el pago
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    // Notas del pago
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    // Comprobante de pago (URL)
    receiptUrl: {
      type: String,
      trim: true,
    },
    // Comprobante de pago (imagen base64) - para distribuidores
    paymentProof: {
      type: String,
      default: null,
    },
    // Tipo MIME del comprobante
    paymentProofMimeType: {
      type: String,
      default: null,
    },
    // Saldo antes del pago
    balanceBefore: {
      type: Number,
      required: true,
    },
    // Saldo después del pago
    balanceAfter: {
      type: Number,
      required: true,
    },
    // Fecha efectiva del pago (puede diferir de createdAt)
    paymentDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Índices
creditPaymentSchema.index({ credit: 1, createdAt: -1 });
creditPaymentSchema.index({ business: 1, createdAt: -1 });
creditPaymentSchema.index({ registeredBy: 1 });

const CreditPayment = mongoose.model("CreditPayment", creditPaymentSchema);

export default CreditPayment;
