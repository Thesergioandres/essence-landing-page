import type { User } from "../../auth/types/auth.types";

export interface StaffMemberRow {
  membershipId: string | null;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  active: boolean;
  phone?: string;
  allowedBranches: string[];
  baseCommissionPercentage: number;
  commissionApplicable: boolean;
  isManagementRole: boolean;
  fixedCommissionOnly: boolean;
  isCommissionFixed: boolean;
  customCommissionRate: number | null;
  permissions?: Record<string, Record<string, boolean>>;
  source: "team" | "employees" | "merged";
  rawUser?: User;
}
