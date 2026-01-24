import mongoose from "mongoose";

const analysisLogSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["daily", "query"],
      default: "daily",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true, // Optimized for retrieving the latest report
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to quickly find the latest report for a business
analysisLogSchema.index({ business: 1, createdAt: -1 });

const AnalysisLog = mongoose.model("AnalysisLog", analysisLogSchema);

export default AnalysisLog;
