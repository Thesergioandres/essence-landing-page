import { GamificationRepository } from "../../../infrastructure/database/repositories/GamificationRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class GamificationPersistenceUseCase {
  constructor(repository = new GamificationRepository()) {
    return createRepositoryGateway(repository);
  }
}
