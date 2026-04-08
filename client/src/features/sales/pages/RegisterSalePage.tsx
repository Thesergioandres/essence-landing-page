import type { RegisterStandardSaleInput } from "../../../core/domain/sales/sales.types";
import { salesWriteUseCases } from "../../../core/use-cases/sales";
import StandardSalePage from "./StandardSalePage";

export default function RegisterSalePage() {
  const registerStandardSale = (data: RegisterStandardSaleInput) =>
    salesWriteUseCases.registerStandardBulk(data);

  return <StandardSalePage registerStandardSale={registerStandardSale} />;
}
