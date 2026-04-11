import { BusinessRepository } from "../../../infrastructure/database/repositories/BusinessRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class BusinessPersistenceUseCase {
  constructor(repository = new BusinessRepository()) {
    return createRepositoryGateway(repository);
  }
}
