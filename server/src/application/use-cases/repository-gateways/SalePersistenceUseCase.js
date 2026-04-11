import { SaleRepository } from "../../../infrastructure/database/repositories/SaleRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class SalePersistenceUseCase {
  constructor(repository = new SaleRepository()) {
    return createRepositoryGateway(repository);
  }
}
