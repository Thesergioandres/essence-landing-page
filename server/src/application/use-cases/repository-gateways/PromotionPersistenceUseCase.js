import { PromotionRepository } from "../../../infrastructure/database/repositories/PromotionRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class PromotionPersistenceUseCase {
  constructor(repository = new PromotionRepository()) {
    return createRepositoryGateway(repository);
  }
}
