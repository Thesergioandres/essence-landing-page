import { AuditRepository } from "../../../infrastructure/database/repositories/AuditRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class AuditPersistenceUseCase {
  constructor(repository = new AuditRepository()) {
    return createRepositoryGateway(repository);
  }
}
