import mongoose from "mongoose";

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB

const issueReportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      index: true,
      enum: ["admin", "super_admin", "distribuidor", "god", "cliente", "guest"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    stackTrace: {
      type: String,
      trim: true,
      maxlength: 20000,
    },
    logs: {
      type: [String],
      default: [],
      validate: {
        validator: function (value) {
          const totalBytes = Buffer.byteLength(
            (value || []).join("\n"),
            "utf8"
          );
          return totalBytes <= MAX_LOG_BYTES;
        },
        message: "El tamaño de los logs excede el límite permitido (5MB)",
      },
    },
    clientContext: {
      url: { type: String, trim: true },
      userAgent: { type: String, trim: true },
      appVersion: { type: String, trim: true },
      businessId: { type: String, trim: true },
    },
    screenshotUrl: { type: String, trim: true },
    screenshotPublicId: { type: String, trim: true },
    status: {
      type: String,
      enum: ["open", "reviewing", "closed"],
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
);

issueReportSchema.index({ createdAt: -1 });

export default mongoose.model("IssueReport", issueReportSchema);
