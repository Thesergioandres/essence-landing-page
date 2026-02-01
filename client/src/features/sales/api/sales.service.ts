import { httpClient } from "../../../shared/api/httpClient";
import type { BulkSalePayload, SaleResponse } from "../types/sales.types";

export const salesService = {
  registerBulkSale: async (payload: BulkSalePayload): Promise<SaleResponse> => {
    // V2 Endpoint - Expecting Atomic Transaction support on Server
    const response = await httpClient.post<SaleResponse>("/v2/sales", payload);
    return response.data;
  },
};
