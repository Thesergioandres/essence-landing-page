import api from "../../../../api/axios";
import type { SalesReadRepository } from "../../../domain/sales/SalesReadRepository";
import type {
  AllSalesFilters,
  AllSalesResponse,
  DistributorSalesFilters,
  DistributorSalesResponse,
} from "../../../domain/sales/sales.types";

export class HttpSalesReadRepository implements SalesReadRepository {
  async getDistributorSales<TSale = unknown, TStats = unknown>({
    distributorId,
    filters,
  }: {
    distributorId?: string;
    filters?: DistributorSalesFilters;
  }): Promise<DistributorSalesResponse<TSale, TStats>> {
    const url = distributorId
      ? `/sales/distributor/${distributorId}`
      : "/sales/distributor";
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
