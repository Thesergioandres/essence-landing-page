import mongoose from "mongoose";

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const employeeScheduleSchema = new mongoose.Schema(
  {
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sedeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    day: {
      type: String,
      enum: DAYS_OF_WEEK,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      match: HH_MM_PATTERN,
    },
    endTime: {
      type: String,
      required: true,
      match: HH_MM_PATTERN,
    },
  },
  {
    timestamps: true,
  },
);

employeeScheduleSchema.index(
  {
    business: 1,
    employeeId: 1,
    day: 1,
    startTime: 1,
    endTime: 1,
  },
  { unique: true },
);

employeeScheduleSchema.index({ business: 1, sedeId: 1, day: 1, startTime: 1 });

export default mongoose.models.EmployeeSchedule ||
  mongoose.model("EmployeeSchedule", employeeScheduleSchema);
