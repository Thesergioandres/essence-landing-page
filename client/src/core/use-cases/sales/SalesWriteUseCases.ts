import type { SalesWriteRepository } from "../../domain/sales/SalesWriteRepository";
import type {
  RegisterPromotionSaleInput,
  RegisterSaleResponse,
  RegisterStandardSaleInput,
} from "../../domain/sales/sales.types";

export class SalesWriteUseCases {
  constructor(private readonly repository: SalesWriteRepository) {}

  async registerStandardBulk(
    data: RegisterStandardSaleInput
  ): Promise<RegisterSaleResponse> {
    return this.repository.registerStandardBulk(data);
  }

  async registerPromotionBulk(
    data: RegisterPromotionSaleInput
  ): Promise<RegisterSaleResponse> {
    return this.repository.registerPromotionBulk(data);
  }
}

export default SalesWriteUseCases;
