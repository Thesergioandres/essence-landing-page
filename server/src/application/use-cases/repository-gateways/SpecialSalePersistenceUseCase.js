import { SpecialSaleRepository } from "../../../infrastructure/database/repositories/SpecialSaleRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class SpecialSalePersistenceUseCase {
  constructor(repository = new SpecialSaleRepository()) {
    return createRepositoryGateway(repository);
  }
}
