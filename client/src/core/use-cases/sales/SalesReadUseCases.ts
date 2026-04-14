import type { SalesReadRepository } from "../../domain/sales/SalesReadRepository";
import type {
  AllSalesFilters,
  AllSalesResponse,
  EmployeeSalesFilters,
  EmployeeSalesResponse,
} from "../../domain/sales/sales.types";

export class SalesReadUseCases {
  constructor(private readonly repository: SalesReadRepository) {}

  async getEmployeeSales<TSale = unknown, TStats = unknown>(params: {
    employeeId?: string;
    filters?: EmployeeSalesFilters;
  }): Promise<EmployeeSalesResponse<TSale, TStats>> {
    return this.repository.getEmployeeSales<TSale, TStats>(params);
  }

  async getAllSales<TSale = unknown, TStats = unknown>(
    filters?: AllSalesFilters
  ): Promise<AllSalesResponse<TSale, TStats>> {
    return this.repository.getAllSales<TSale, TStats>(filters);
  }
}

export default SalesReadUseCases;
