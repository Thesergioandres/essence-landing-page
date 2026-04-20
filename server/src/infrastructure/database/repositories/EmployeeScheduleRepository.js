import mongoose from "mongoose";
import { employeeRoleQuery } from "../../../utils/roleAliases.js";
import Branch from "../models/Branch.js";
import EmployeeSchedule, { DAYS_OF_WEEK } from "../models/EmployeeSchedule.js";
import Membership from "../models/Membership.js";

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ADMIN_ROLES = new Set(["admin", "super_admin", "god"]);
const TRANSACTION_UNSUPPORTED_PATTERNS = [
  "Transaction numbers are only allowed",
  "Transaction is not supported",
  "replica set member",
  "not a mongos",
];

const dayRank = new Map(DAYS_OF_WEEK.map((day, index) => [day, index]));

const normalizeDay = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const toMinutes = (value) => {
  const match = String(value || "")
    .trim()
    .match(HH_MM_PATTERN);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour * 60 + minute;
};

const sortSchedules = (schedules = []) =>
  [...schedules].sort((left, right) => {
    const dayDiff =
      (dayRank.get(String(left.day)) ?? 999) -
      (dayRank.get(String(right.day)) ?? 999);

    if (dayDiff !== 0) {
      return dayDiff;
    }

    return String(left.startTime).localeCompare(String(right.startTime));
  });

const normalizeEntry = (entry, index) => {
  if (!entry || typeof entry !== "object") {
    const error = new Error(
      `Entrada de horario invalida en posicion ${index + 1}`,
    );
    error.statusCode = 400;
    throw error;
  }

  const day = normalizeDay(entry.day);
  const startTime = String(entry.startTime || "").trim();
  const endTime = String(entry.endTime || "").trim();
  const sedeId = String(entry.sedeId || "").trim();

  if (!DAYS_OF_WEEK.includes(day)) {
    const error = new Error(`Dia invalido en posicion ${index + 1}`);
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.isValidObjectId(sedeId)) {
    const error = new Error(`Sede invalida en posicion ${index + 1}`);
    error.statusCode = 400;
    throw error;
  }

  if (!HH_MM_PATTERN.test(startTime) || !HH_MM_PATTERN.test(endTime)) {
    const error = new Error(
      `Formato de hora invalido en posicion ${index + 1}. Usa HH:mm`,
    );
    error.statusCode = 400;
    throw error;
  }

  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);

  if (
    startMinutes === null ||
    endMinutes === null ||
    startMinutes >= endMinutes
  ) {
    const error = new Error(
      `Rango horario invalido en posicion ${index + 1}. startTime debe ser menor que endTime`,
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    day,
    sedeId,
    startTime,
    endTime,
  };
};

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");
  return TRANSACTION_UNSUPPORTED_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
};

const buildScope = (businessId, requesterRole) => {
  if (requesterRole === "god") {
    return {};
  }

  return { business: businessId };
};

class EmployeeScheduleRepository {
  async validateEmployeeScope(
    employeeId,
    businessId,
    requesterRole,
    session = null,
  ) {
    if (requesterRole === "god") {
      return;
    }

    const membership = await Membership.findOne({
      business: businessId,
      user: employeeId,
      role: employeeRoleQuery,
      status: "active",
    }).session(session);

    if (!membership) {
      const error = new Error("Empleado no encontrado en este negocio");
      error.statusCode = 404;
      throw error;
    }
  }

  async validateBranchScope(sedeId, businessId, requesterRole, session = null) {
    if (requesterRole === "god") {
      return;
    }

    const branch = await Branch.findOne({
      _id: sedeId,
      business: businessId,
    })
      .select("_id")
      .session(session)
      .lean();

    if (!branch) {
      const error = new Error("La sede no pertenece a este negocio");
      error.statusCode = 404;
      throw error;
    }
  }

  async listByEmployee({ businessId, employeeId, requesterRole }) {
    await this.validateEmployeeScope(employeeId, businessId, requesterRole);

    const schedules = await EmployeeSchedule.find({
      ...buildScope(businessId, requesterRole),
      employeeId,
    })
      .populate("employeeId", "name email")
      .populate("sedeId", "name")
      .lean();

    return sortSchedules(schedules);
  }

  async replaceEmployeeAvailability({
    businessId,
    employeeId,
    requesterRole,
    entries,
  }) {
    if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
      const error = new Error("employeeId invalido");
      error.statusCode = 400;
      throw error;
    }

    await this.validateEmployeeScope(employeeId, businessId, requesterRole);

    const normalizedEntries = (Array.isArray(entries) ? entries : []).map(
      (entry, index) => normalizeEntry(entry, index),
    );

    const uniqueBranchIds = [
      ...new Set(normalizedEntries.map((entry) => entry.sedeId)),
    ];
    for (const sedeId of uniqueBranchIds) {
      await this.validateBranchScope(sedeId, businessId, requesterRole);
    }

    const writeSchedules = async (session = null) => {
      const scope = {
        ...buildScope(businessId, requesterRole),
        employeeId,
      };

      if (session) {
        await EmployeeSchedule.deleteMany(scope).session(session);
      } else {
        await EmployeeSchedule.deleteMany(scope);
      }

      if (normalizedEntries.length === 0) {
        return [];
      }

      const docs = normalizedEntries.map((entry) => ({
        business: businessId,
        employeeId,
        sedeId: entry.sedeId,
        day: entry.day,
        startTime: entry.startTime,
        endTime: entry.endTime,
      }));

      if (session) {
        await EmployeeSchedule.insertMany(docs, { session });
      } else {
        await EmployeeSchedule.insertMany(docs);
      }

      return docs;
    };

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await writeSchedules(session);
      await session.commitTransaction();
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      if (isTransactionUnsupportedError(error)) {
        await writeSchedules();
      } else {
        throw error;
      }
    } finally {
      session.endSession();
    }

    return this.listByEmployee({ businessId, employeeId, requesterRole });
  }

  async getBranchOverview({
    businessId,
    requesterRole,
    sedeId = null,
    day = null,
  }) {
    if (sedeId) {
      await this.validateBranchScope(sedeId, businessId, requesterRole);
    }

    const normalizedDay = day ? normalizeDay(day) : null;
    if (normalizedDay && !DAYS_OF_WEEK.includes(normalizedDay)) {
      const error = new Error("Dia invalido");
      error.statusCode = 400;
      throw error;
    }

    const filter = {
      ...buildScope(businessId, requesterRole),
      ...(sedeId ? { sedeId } : {}),
      ...(normalizedDay ? { day: normalizedDay } : {}),
    };

    const schedules = await EmployeeSchedule.find(filter)
      .populate("employeeId", "name email")
      .populate("sedeId", "name")
      .lean();

    const sortedSchedules = sortSchedules(schedules);

    const groupedByDay = DAYS_OF_WEEK.reduce((accumulator, currentDay) => {
      accumulator[currentDay] = sortedSchedules.filter(
        (schedule) => schedule.day === currentDay,
      );
      return accumulator;
    }, {});

    return {
      schedules: sortedSchedules,
      groupedByDay,
      total: sortedSchedules.length,
    };
  }

  async canManageEmployeeSchedule(requesterRole, requesterId, employeeId) {
    if (ADMIN_ROLES.has(requesterRole)) {
      return true;
    }

    return String(requesterId || "") === String(employeeId || "");
  }
}

export default new EmployeeScheduleRepository();
