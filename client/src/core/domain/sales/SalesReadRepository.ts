import type {
  AllSalesFilters,
  AllSalesResponse,
  EmployeeSalesFilters,
  EmployeeSalesResponse,
} from "./sales.types";

export interface SalesReadRepository {
  getEmployeeSales<TSale = unknown, TStats = unknown>(params: {
    employeeId?: string;
    filters?: EmployeeSalesFilters;
  }): Promise<EmployeeSalesResponse<TSale, TStats>>;

  getAllSales<TSale = unknown, TStats = unknown>(
    filters?: AllSalesFilters
  ): Promise<AllSalesResponse<TSale, TStats>>;
}
