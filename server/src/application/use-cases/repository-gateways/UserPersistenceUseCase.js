import { UserRepository } from "../../../infrastructure/database/repositories/UserRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class UserPersistenceUseCase {
  constructor(repository = new UserRepository()) {
    return createRepositoryGateway(repository);
  }
}
