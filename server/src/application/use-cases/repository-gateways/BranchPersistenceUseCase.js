import BranchRepository from "../../../infrastructure/database/repositories/BranchRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const branchPersistenceUseCase = createRepositoryGateway(BranchRepository);

export default branchPersistenceUseCase;
