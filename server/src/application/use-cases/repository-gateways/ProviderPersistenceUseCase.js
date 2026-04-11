import { ProviderRepository } from "../../../infrastructure/database/repositories/ProviderRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class ProviderPersistenceUseCase {
  constructor(repository = new ProviderRepository()) {
    return createRepositoryGateway(repository);
  }
}
