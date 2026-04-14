import mongoose from "mongoose";

const employeeStockSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, "La cantidad no puede ser negativa"],
      default: 0,
    },
    inTransitQuantity: {
      type: Number,
      required: true,
      min: [0, "La cantidad en tránsito no puede ser negativa"],
      default: 0,
    },
    lowStockAlert: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  },
);

// Índice compuesto para evitar duplicados
employeeStockSchema.index(
  { business: 1, employee: 1, product: 1 },
  { unique: true },
);
// Índice adicional para queries por employee
employeeStockSchema.index({ business: 1, employee: 1, quantity: 1 });
employeeStockSchema.index({
  business: 1,
  employee: 1,
  inTransitQuantity: 1,
});

export default mongoose.model("EmployeeStock", employeeStockSchema);
