import type {
  DispatchHotSector as CoreDispatchHotSector,
  DispatchItem as CoreDispatchItem,
  DispatchRequest as CoreDispatchRequest,
  DispatchStatus as CoreDispatchStatus,
} from "../../../core/domain/dispatch/dispatch.types";
import { dispatchUseCases } from "../../../core/use-cases/dispatch";

export type DispatchStatus = CoreDispatchStatus;
export type DispatchItem = CoreDispatchItem;
export type DispatchRequest = CoreDispatchRequest;
export type DispatchHotSector = CoreDispatchHotSector;

export const dispatchService = {
  async createRequest(data: {
    employeeId: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
  }): Promise<DispatchRequest> {
    return dispatchUseCases.createRequest(data);
  },

  async getRequests(params?: {
    status?: DispatchStatus;
    employeeId?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    data: DispatchRequest[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    return dispatchUseCases.getRequests(params);
  },

  async markAsDispatched(
    id: string,
    payload: {
      shippingGuide?: string;
      guideImage?: string;
      dispatchNotes?: string;
    }
  ): Promise<DispatchRequest> {
    return dispatchUseCases.markAsDispatched(id, payload);
  },

  async confirmReception(id: string): Promise<DispatchRequest> {
    return dispatchUseCases.confirmReception(id);
  },

  async getPendingCount(): Promise<number> {
    return dispatchUseCases.getPendingCount();
  },

  async getPendingReceptionCount(): Promise<number> {
    return dispatchUseCases.getPendingReceptionCount();
  },

  async getHotSectors(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    canViewFinancialMargins: boolean;
    employees: DispatchHotSector[];
    branches: DispatchHotSector[];
  }> {
    return dispatchUseCases.getHotSectors(params);
  },
};
