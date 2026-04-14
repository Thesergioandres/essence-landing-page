import api from "../../../../api/axios";
import type { DispatchRepository } from "../../../domain/dispatch/DispatchRepository";
import type {
  DispatchRequest,
  DispatchRequestsQuery,
  DispatchRequestsResult,
} from "../../../domain/dispatch/dispatch.types";

const defaultPagination = {
  page: 1,
  limit: 20,
  total: 0,
  pages: 0,
};

export class HttpDispatchRepository implements DispatchRepository {
  async createRequest(data: {
    employeeId: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
  }): Promise<DispatchRequest> {
    const response = await api.post("/dispatches/requests", data);
    return response.data?.data;
  }

  async getRequests(
    params?: DispatchRequestsQuery
  ): Promise<DispatchRequestsResult> {
    const response = await api.get("/dispatches/requests", { params });
    return {
      data: response.data?.data || [],
      pagination: response.data?.pagination || defaultPagination,
    };
  }

  async markAsDispatched(
    id: string,
    payload: {
      shippingGuide?: string;
      guideImage?: string;
      dispatchNotes?: string;
    }
  ): Promise<DispatchRequest> {
    const response = await api.patch(
      `/dispatches/requests/${id}/dispatch`,
      payload
    );
    return response.data?.data;
  }

  async confirmReception(id: string): Promise<DispatchRequest> {
    const response = await api.patch(`/dispatches/requests/${id}/receive`);
    return response.data?.data;
  }

  async getPendingCount(): Promise<number> {
    const response = await api.get("/dispatches/requests", {
      // Compatibilidad con backends que aún no exponen /pending-count.
      params: {
        status: "PENDIENTE",
        page: 1,
        limit: 1,
      },
      // Para ciertos roles/no autenticado el backend puede responder 401/403.
      // En dashboard lo tratamos como contador no disponible (=0).
      validateStatus: status =>
        (status >= 200 && status < 300) ||
        status === 401 ||
        status === 403 ||
        status === 404,
    });

    if (response.status >= 400) {
      return 0;
    }

    return Number(response.data?.pagination?.total || 0);
  }

  async getPendingReceptionCount(): Promise<number> {
    const response = await api.get("/dispatches/requests", {
      params: {
        status: "DESPACHADO",
        page: 1,
        limit: 1,
      },
    });

    return Number(response.data?.pagination?.total || 0);
  }

  async getHotSectors(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{
    canViewFinancialMargins: boolean;
    employees: any[];
    branches: any[];
  }> {
    const response = await api.get("/dispatches/hot-sectors", { params });
    const payload = response.data?.data || {};

    return {
      canViewFinancialMargins: payload.canViewFinancialMargins === true,
      employees: Array.isArray(payload.employees)
        ? payload.employees
        : [],
      branches: Array.isArray(payload.branches) ? payload.branches : [],
    };
  }
}

export default HttpDispatchRepository;
