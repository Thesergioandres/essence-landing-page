import { BranchTransferRepository } from "../../../infrastructure/database/repositories/BranchTransferRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

export class BranchTransferPersistenceUseCase {
  constructor(repository = new BranchTransferRepository()) {
    return createRepositoryGateway(repository);
  }
}
