import { AdvancedAnalyticsRepository } from "../../../infrastructure/database/repositories/AdvancedAnalyticsRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class AdvancedAnalyticsPersistenceUseCase {
  constructor(repository = new AdvancedAnalyticsRepository()) {
    return createRepositoryGateway(repository);
  }
}
