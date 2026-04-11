import ProfitHistoryRepository from "../../../infrastructure/database/repositories/ProfitHistoryRepository.js";
import { createRepositoryGateway } from "./createRepositoryGateway.js";

const profitHistoryPersistenceUseCase = createRepositoryGateway(ProfitHistoryRepository);

export default profitHistoryPersistenceUseCase;
