import SaleReadRepositoryAdapter from "../../../infrastructure/adapters/repositories/SaleReadRepositoryAdapter.js";
import ListSalesUseCase from "./ListSalesUseCase.js";

const saleReadRepository = new SaleReadRepositoryAdapter();

export const listSalesUseCase = new ListSalesUseCase(saleReadRepository);
