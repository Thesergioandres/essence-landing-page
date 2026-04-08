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
    const response = await api.post("/sales/standard", data);
    return response.data;
  }

  async registerPromotionBulk(
    data: RegisterPromotionSaleInput
  ): Promise<RegisterSaleResponse> {
    const response = await api.post("/sales/promotion", data);
    return response.data;
  }
}

export default HttpSalesWriteRepository;
