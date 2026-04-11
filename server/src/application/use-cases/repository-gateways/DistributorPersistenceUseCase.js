import { DistributorRepository } from "../../../infrastructure/database/repositories/DistributorRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class DistributorPersistenceUseCase {
  constructor(repository = new DistributorRepository()) {
    return createRepositoryGateway(repository);
  }
}
