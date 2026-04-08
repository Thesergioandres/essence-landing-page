import type {
  DispatchHotSector,
  DispatchRequest,
  DispatchRequestsQuery,
  DispatchRequestsResult,
} from "./dispatch.types";

export interface DispatchRepository {
  createRequest(data: {
    distributorId: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
  }): Promise<DispatchRequest>;
  getRequests(params?: DispatchRequestsQuery): Promise<DispatchRequestsResult>;
  markAsDispatched(
    id: string,
    payload: {
      shippingGuide?: string;
      guideImage?: string;
      dispatchNotes?: string;
    }
  ): Promise<DispatchRequest>;
  confirmReception(id: string): Promise<DispatchRequest>;
  getPendingCount(): Promise<number>;
  getPendingReceptionCount(): Promise<number>;
  getHotSectors(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    canViewFinancialMargins: boolean;
    distributors: DispatchHotSector[];
    branches: DispatchHotSector[];
  }>;
}
