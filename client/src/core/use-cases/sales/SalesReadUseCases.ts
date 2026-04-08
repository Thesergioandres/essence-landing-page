import type { SalesReadRepository } from "../../domain/sales/SalesReadRepository";
import type {
  AllSalesFilters,
  AllSalesResponse,
  DistributorSalesFilters,
  DistributorSalesResponse,
} from "../../domain/sales/sales.types";

export class SalesReadUseCases {
  constructor(private readonly repository: SalesReadRepository) {}

  async getDistributorSales<TSale = unknown, TStats = unknown>(params: {
    distributorId?: string;
    filters?: DistributorSalesFilters;
  }): Promise<DistributorSalesResponse<TSale, TStats>> {
    return this.repository.getDistributorSales<TSale, TStats>(params);
  }

  async getAllSales<TSale = unknown, TStats = unknown>(
    filters?: AllSalesFilters
  ): Promise<AllSalesResponse<TSale, TStats>> {
    return this.repository.getAllSales<TSale, TStats>(filters);
  }
}

export default SalesReadUseCases;
