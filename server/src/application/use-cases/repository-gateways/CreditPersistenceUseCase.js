import CreditRepository from "../../../infrastructure/database/repositories/CreditRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const creditPersistenceUseCase = createRepositoryGateway(CreditRepository);

export default creditPersistenceUseCase;
