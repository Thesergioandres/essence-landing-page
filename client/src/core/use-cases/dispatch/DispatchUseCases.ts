import type { DispatchRepository } from "../../domain/dispatch/DispatchRepository";
import type {
  DispatchRequest,
  DispatchRequestsQuery,
  DispatchRequestsResult,
} from "../../domain/dispatch/dispatch.types";

export class DispatchUseCases {
  constructor(private readonly repository: DispatchRepository) {}

  async createRequest(data: {
    distributorId: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
  }): Promise<DispatchRequest> {
    return this.repository.createRequest(data);
  }

  async getRequests(
    query?: DispatchRequestsQuery
  ): Promise<DispatchRequestsResult> {
    return this.repository.getRequests(query);
  }

  async markAsDispatched(
    id: string,
    payload: {
      shippingGuide?: string;
      guideImage?: string;
      dispatchNotes?: string;
    }
  ): Promise<DispatchRequest> {
    return this.repository.markAsDispatched(id, payload);
  }

  async confirmReception(id: string): Promise<DispatchRequest> {
    return this.repository.confirmReception(id);
  }

  async getPendingCount(): Promise<number> {
    return this.repository.getPendingCount();
  }

  async getPendingReceptionCount(): Promise<number> {
    return this.repository.getPendingReceptionCount();
  }

  async getHotSectors(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    canViewFinancialMargins: boolean;
    distributors: any[];
    branches: any[];
  }> {
    return this.repository.getHotSectors(params);
  }
}

export default DispatchUseCases;
