import { IssueRepository } from "../../../infrastructure/database/repositories/IssueRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class IssuePersistenceUseCase {
  constructor(repository = new IssueRepository()) {
    return createRepositoryGateway(repository);
  }
}
