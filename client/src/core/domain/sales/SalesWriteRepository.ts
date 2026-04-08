import type {
  RegisterPromotionSaleInput,
  RegisterSaleResponse,
  RegisterStandardSaleInput,
} from "./sales.types";

export interface SalesWriteRepository {
  registerStandardBulk(
    data: RegisterStandardSaleInput
  ): Promise<RegisterSaleResponse>;

  registerPromotionBulk(
    data: RegisterPromotionSaleInput
  ): Promise<RegisterSaleResponse>;
}
