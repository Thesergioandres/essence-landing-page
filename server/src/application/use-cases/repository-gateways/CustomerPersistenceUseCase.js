import { CustomerRepository } from "../../../infrastructure/database/repositories/CustomerRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class CustomerPersistenceUseCase {
  constructor(repository = new CustomerRepository()) {
    return createRepositoryGateway(repository);
  }
}
