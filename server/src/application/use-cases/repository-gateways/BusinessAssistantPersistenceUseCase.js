import { BusinessAssistantRepository } from "../../../infrastructure/database/repositories/BusinessAssistantRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class BusinessAssistantPersistenceUseCase {
  constructor(repository = new BusinessAssistantRepository()) {
    return createRepositoryGateway(repository);
  }
}
