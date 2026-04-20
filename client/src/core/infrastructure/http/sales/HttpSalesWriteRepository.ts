import api from "../../../../api/axios";
import type { SalesWriteRepository } from "../../../domain/sales/SalesWriteRepository";
import type {
  RegisterPromotionSaleInput,
  RegisterSaleResponse,
  RegisterStandardSaleInput,
} from "../../../domain/sales/sales.types";

export class HttpSalesWriteRepository implements SalesWriteRepository {
  async registerStandardBulk(
    data: RegisterStandardSaleInput
  ): Promise<RegisterSaleResponse> {
    const { businessId, ...payload } = data;
    const response = await api.post("/sales/standard", payload, {
      headers: businessId ? { "x-business-id": businessId } : undefined,
    });
    return response.data;
  }

  async registerPromotionBulk(
    data: RegisterPromotionSaleInput
  ): Promise<RegisterSaleResponse> {
    const { businessId, ...payload } = data;
    const response = await api.post("/sales/promotion", payload, {
      headers: businessId ? { "x-business-id": businessId } : undefined,
    });
    return response.data;
  }
}

export default HttpSalesWriteRepository;
