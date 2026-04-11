import mongoose from "mongoose";

const segmentSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    rules: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

segmentSchema.index({ business: 1, key: 1 }, { unique: true });
segmentSchema.index({ business: 1, name: 1 });

export default mongoose.model("Segment", segmentSchema);
