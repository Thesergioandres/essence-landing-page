import type {
  AllSalesFilters,
  AllSalesResponse,
  DistributorSalesFilters,
  DistributorSalesResponse,
} from "./sales.types";

export interface SalesReadRepository {
  getDistributorSales<TSale = unknown, TStats = unknown>(params: {
    distributorId?: string;
    filters?: DistributorSalesFilters;
  }): Promise<DistributorSalesResponse<TSale, TStats>>;

  getAllSales<TSale = unknown, TStats = unknown>(
    filters?: AllSalesFilters
  ): Promise<AllSalesResponse<TSale, TStats>>;
}
