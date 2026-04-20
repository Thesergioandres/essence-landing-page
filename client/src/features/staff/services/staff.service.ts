import type { User } from "../../auth/types/auth.types";
import { businessService } from "../../business/services";
import { employeeService } from "../../employees/services";
import type { StaffMemberRow } from "../types/staff.types";

const DEFAULT_BASE_COMMISSION = 20;
const MANAGEMENT_ROLES = new Set(["admin", "super_admin", "god"]);
const COMMISSION_ELIGIBLE_ROLES = new Set(["employee", "operativo"]);

const normalizeRole = (role: unknown) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return normalized === "superadmin" ? "super_admin" : normalized;
};

const isManagementRole = (role: unknown) =>
  MANAGEMENT_ROLES.has(normalizeRole(role));

const isCommissionApplicableRole = (role: unknown) =>
  COMMISSION_ELIGIBLE_ROLES.has(normalizeRole(role));

const resolveEntityId = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && trimmed !== "[object Object]" ? trimmed : "";
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = value as {
    _id?: unknown;
    id?: unknown;
    $oid?: unknown;
  };

  return (
    resolveEntityId(candidate._id) ||
    resolveEntityId(candidate.id) ||
    resolveEntityId(candidate.$oid) ||
    ""
  );
};

const normalizeRate = (value: unknown, fallback = DEFAULT_BASE_COMMISSION) => {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) {
    return fallback;
  }

  return Math.max(0, Math.min(95, candidate));
};

const resolveCommissionRateForRole = (role: unknown, value: unknown) =>
  isCommissionApplicableRole(role) ? normalizeRate(value) : 0;

const normalizeMembershipUser = (value: unknown): User | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as User;
};

const sortRows = (rows: StaffMemberRow[]) => {
  const roleRank: Record<string, number> = {
    god: 0,
    super_admin: 1,
    admin: 2,
    employee: 3,
    operativo: 3,
    viewer: 4,
  };

  return [...rows].sort((left, right) => {
    const leftRank = roleRank[left.role] ?? 99;
    const rightRank = roleRank[right.role] ?? 99;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.name.localeCompare(right.name, "es", {
      sensitivity: "base",
    });
  });
};

export const staffService = {
  async getUnifiedStaff(businessId: string): Promise<StaffMemberRow[]> {
    const [membersResponse, employeesResponse] = await Promise.all([
      businessService.listMembers(businessId),
      employeeService.getAll({ limit: 500 }),
    ]);

    const rowsByEmployeeId = new Map<string, StaffMemberRow>();

    for (const member of membersResponse.members || []) {
      const membershipUser = normalizeMembershipUser(member.user);
      const employeeId = resolveEntityId(membershipUser?._id || member.user);

      if (!employeeId) {
        continue;
      }

      const resolvedRole = String(
        member.role || membershipUser?.role || "employee"
      );
      const commissionApplicable = isCommissionApplicableRole(resolvedRole);

      rowsByEmployeeId.set(employeeId, {
        membershipId: member._id || null,
        employeeId,
        name: membershipUser?.name || "Sin nombre",
        email: membershipUser?.email || "",
        role: resolvedRole,
        status: String(member.status || membershipUser?.status || "active"),
        active: membershipUser?.active !== false,
        phone: membershipUser?.phone,
        baseCommissionPercentage: resolveCommissionRateForRole(
          resolvedRole,
          membershipUser?.baseCommissionPercentage
        ),
        commissionApplicable,
        isManagementRole: isManagementRole(resolvedRole),
        fixedCommissionOnly: commissionApplicable
          ? Boolean(membershipUser?.fixedCommissionOnly)
          : false,
        isCommissionFixed: commissionApplicable
          ? Boolean(membershipUser?.isCommissionFixed)
          : false,
        customCommissionRate:
          !commissionApplicable ||
          membershipUser?.customCommissionRate === null ||
          membershipUser?.customCommissionRate === undefined
            ? null
            : normalizeRate(membershipUser.customCommissionRate, 0),
        permissions: member.permissions,
        source: "team",
        rawUser: membershipUser || undefined,
      });
    }

    for (const employee of employeesResponse.data || []) {
      const employeeId = resolveEntityId(employee?._id);

      if (!employeeId) {
        continue;
      }

      const existing = rowsByEmployeeId.get(employeeId);

      if (existing) {
        const mergedRole = String(employee.role || existing.role || "employee");
        const commissionApplicable = isCommissionApplicableRole(mergedRole);

        rowsByEmployeeId.set(employeeId, {
          ...existing,
          name: employee.name || existing.name,
          email: employee.email || existing.email,
          role: mergedRole,
          phone: employee.phone || existing.phone,
          active: employee.active !== false,
          status: employee.status || existing.status,
          baseCommissionPercentage: commissionApplicable
            ? normalizeRate(
                employee.baseCommissionPercentage,
                existing.baseCommissionPercentage
              )
            : 0,
          commissionApplicable,
          isManagementRole: isManagementRole(mergedRole),
          fixedCommissionOnly: commissionApplicable
            ? Boolean(
                employee.fixedCommissionOnly ?? existing.fixedCommissionOnly
              )
            : false,
          isCommissionFixed: commissionApplicable
            ? Boolean(employee.isCommissionFixed ?? existing.isCommissionFixed)
            : false,
          customCommissionRate: !commissionApplicable
            ? null
            : employee.customCommissionRate === null ||
                employee.customCommissionRate === undefined
              ? existing.customCommissionRate
              : normalizeRate(employee.customCommissionRate, 0),
          source: "merged",
          rawUser: employee,
        });
        continue;
      }

      const resolvedRole = String(employee.role || "employee");
      const commissionApplicable = isCommissionApplicableRole(resolvedRole);

      rowsByEmployeeId.set(employeeId, {
        membershipId: null,
        employeeId,
        name: employee.name || "Sin nombre",
        email: employee.email || "",
        role: resolvedRole,
        status: String(employee.status || "active"),
        active: employee.active !== false,
        phone: employee.phone,
        baseCommissionPercentage: resolveCommissionRateForRole(
          resolvedRole,
          employee.baseCommissionPercentage
        ),
        commissionApplicable,
        isManagementRole: isManagementRole(resolvedRole),
        fixedCommissionOnly: commissionApplicable
          ? Boolean(employee.fixedCommissionOnly)
          : false,
        isCommissionFixed: commissionApplicable
          ? Boolean(employee.isCommissionFixed)
          : false,
        customCommissionRate:
          !commissionApplicable ||
          employee.customCommissionRate === null ||
          employee.customCommissionRate === undefined
            ? null
            : normalizeRate(employee.customCommissionRate, 0),
        source: "employees",
        rawUser: employee,
      });
    }

    return sortRows(Array.from(rowsByEmployeeId.values()));
  },

  async updateBaseCommissionPercentage(
    employeeId: string,
    baseCommissionPercentage: number,
    options?: { targetRole?: string }
  ): Promise<number> {
    if (
      options?.targetRole &&
      !isCommissionApplicableRole(options.targetRole)
    ) {
      throw new Error("Solo perfiles operativos pueden editar comisión base.");
    }

    const payload = await employeeService.updateBaseCommissionPercentage(
      employeeId,
      baseCommissionPercentage,
      {
        targetRole: options?.targetRole,
      }
    );

    return normalizeRate(payload.baseCommissionPercentage);
  },
};
