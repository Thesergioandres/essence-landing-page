export const EMPLOYEE_ROLE = "employee";

export const LEGACY_EMPLOYEE_ROLES = Object.freeze([
  "empleado",
  "employee",
]);

export const EMPLOYEE_ROLE_ALIASES = Object.freeze([
  EMPLOYEE_ROLE,
  ...LEGACY_EMPLOYEE_ROLES,
]);

export const isEmployeeRole = (role) => EMPLOYEE_ROLE_ALIASES.includes(role);

export const normalizeEmployeeRole = (role) =>
  isEmployeeRole(role) ? EMPLOYEE_ROLE : role;

export const employeeRoleQuery = {
  $in: EMPLOYEE_ROLE_ALIASES,
};
