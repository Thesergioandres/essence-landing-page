import { NotificationRepository } from "../../../infrastructure/database/repositories/NotificationRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class NotificationPersistenceUseCase {
  constructor(repository = new NotificationRepository()) {
    return createRepositoryGateway(repository);
  }
}
