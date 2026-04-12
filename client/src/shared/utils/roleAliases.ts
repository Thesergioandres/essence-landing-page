export const EMPLOYEE_ROLE = "employee";

export const EMPLOYEE_ROLE_ALIASES = [
  EMPLOYEE_ROLE,
  "distributor",
  "distribuidor",
] as const;

export const isEmployeeRole = (role?: string | null): boolean =>
  EMPLOYEE_ROLE_ALIASES.includes(
    (role || "") as (typeof EMPLOYEE_ROLE_ALIASES)[number]
  );

export const normalizeEmployeeRole = (role?: string | null): string =>
  isEmployeeRole(role) ? EMPLOYEE_ROLE : role || "";
