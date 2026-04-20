import api from "../../../../api/axios";
import type { SalesReadRepository } from "../../../domain/sales/SalesReadRepository";
import type {
  AllSalesFilters,
  AllSalesResponse,
  EmployeeSalesFilters,
  EmployeeSalesResponse,
} from "../../../domain/sales/sales.types";

export class HttpSalesReadRepository implements SalesReadRepository {
  async getEmployeeSales<TSale = unknown, TStats = unknown>({
    employeeId,
    filters,
  }: {
    employeeId?: string;
    filters?: EmployeeSalesFilters;
  }): Promise<EmployeeSalesResponse<TSale, TStats>> {
    const url = employeeId
      ? `/sales/employee/${employeeId}`
      : "/sales/employee";
    const response = await api.get(url, { params: filters });
    return response.data;
  }

  async getAllSales<TSale = unknown, TStats = unknown>(
    filters?: AllSalesFilters
  ): Promise<AllSalesResponse<TSale, TStats>> {
    const response = await api.get("/sales", { params: filters });
    return response.data;
  }
}

export default HttpSalesReadRepository;
