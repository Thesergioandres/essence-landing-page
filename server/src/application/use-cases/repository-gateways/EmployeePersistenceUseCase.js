import { EmployeeRepository } from "../../../infrastructure/database/repositories/EmployeeRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class EmployeePersistenceUseCase {
  constructor(repository = new EmployeeRepository()) {
    return createRepositoryGateway(repository);
  }
}
