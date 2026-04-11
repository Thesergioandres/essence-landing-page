import { ProductRepository } from "../../../infrastructure/database/repositories/ProductRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class ProductPersistenceUseCase {
  constructor(repository = new ProductRepository()) {
    return createRepositoryGateway(repository);
  }
}
