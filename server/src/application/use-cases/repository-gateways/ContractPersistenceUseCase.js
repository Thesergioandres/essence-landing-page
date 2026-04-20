import contractRepository from "../../../infrastructure/database/repositories/ContractRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const contractPersistenceUseCase = createRepositoryGateway(contractRepository);

export default contractPersistenceUseCase;
