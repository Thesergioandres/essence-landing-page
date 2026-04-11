import mongoose from "mongoose";

const branchStockSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockAlert: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

branchStockSchema.index(
  { business: 1, branch: 1, product: 1 },
  { unique: true }
);

export default mongoose.model("BranchStock", branchStockSchema);
