import { AnalyticsRepository } from "../../../infrastructure/database/repositories/AnalyticsRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class AnalyticsPersistenceUseCase {
  constructor(repository = new AnalyticsRepository()) {
    return createRepositoryGateway(repository);
  }
}
