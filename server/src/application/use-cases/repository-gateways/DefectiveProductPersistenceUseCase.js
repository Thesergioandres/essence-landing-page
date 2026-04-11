import { DefectiveProductRepository } from "../../../infrastructure/database/repositories/DefectiveProductRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class DefectiveProductPersistenceUseCase {
  constructor(repository = new DefectiveProductRepository()) {
    return createRepositoryGateway(repository);
  }
}
